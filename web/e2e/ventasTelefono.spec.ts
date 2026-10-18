/**
 * The sales screens on a real phone browser, end to end (GH-78, subtask "nv-loading"): a sale is
 * recorded from a phone with an existing customer, with a new one made from inside the
 * sheet and with none; and at 320, 375 and 430 px, Nueva venta, Ventas and a sale's detail
 * (dialogs included) overflow nowhere sideways, every interactive element is at least 44 px
 * tall, every input at least 16 px, and Ventas' tabs sit in two or four columns, never three.
 *
 * That holds with the text at 130 % (GH-104): the scaled cases run at the real widths 320, 375
 * and 430, with every element's font size, px line height and the root's rem scaled by
 * `helpers/textScale.ts` (read its header for what that models and what it leaves out). The
 * target stays 44 px and the input floor becomes 16 px × 1.3. Two more cases narrow the viewport
 * to 246 and 331 px, the widths 320 and 430 get at 130 % page zoom, with the text unscaled: they
 * model page zoom, not text size.
 */

import { SALE_NEW, SALES, VARIETIES } from '../src/routes.js'
import { expect, test, type WorkerServer } from './fixtures.js'
import type { Browser, BrowserContext, Page } from '@playwright/test'
import { signUpNewBusiness } from './helpers/signup.js'
import { setPriceDate } from './helpers/priceDate.js'
import { fillSaleLine } from './helpers/sale.js'
import {
  LOADING_MARKER,
  PHONE_CONTEXT,
  TEXT_SCALE,
  expectNoSidewaysOverflow,
  expectThumbSized,
} from './helpers/textScale.js'
import { uniqueTag } from './helpers/unique.js'

const HEIGHT_AT = { 246: 720, 320: 720, 331: 900, 375: 812, 430: 900 }

interface PhoneCase {
  name: string
  width: number
  height: number
  scale: number
}

const phone = (name: string, width: keyof typeof HEIGHT_AT, scale: number): PhoneCase => ({
  name,
  width,
  height: HEIGHT_AT[width],
  scale,
})

const CASES: PhoneCase[] = [
  phone('320', 320, 1),
  phone('375', 375, 1),
  phone('430', 430, 1),
  phone('320 at 130 % text', 320, TEXT_SCALE),
  phone('375 at 130 % text', 375, TEXT_SCALE),
  phone('430 at 130 % text', 430, TEXT_SCALE),
  // What 130 % page zoom does to the CSS viewport; the text is not scaled.
  phone('320 at 130 % page zoom', 246, 1),
  phone('430 at 130 % page zoom', 331, 1),
]

test.use({ ...PHONE_CONTEXT, viewport: { width: 375, height: 812 } })

async function signUpWithAVariety(page: Page): Promise<void> {
  await signUpNewBusiness(page, { businessName: `Vivero Telefono ${uniqueTag()}`, email: `telefono-venta-${uniqueTag()}@example.com` })
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'New variety' }).click()
  await page.getByLabel('Name').fill('Jazmín')
  await page.getByRole('button', { name: 'Add variety' }).click()
  await expect(page.getByText('Variety saved')).toBeVisible()
  await page.getByRole('link', { name: /Jazmín/ }).click()
  await page.getByRole('link', { name: 'New price' }).click()
  await setPriceDate(page, '2000-01-01')
  await page.getByLabel(/^List price/).fill('500')
  await page.getByRole('button', { name: 'Save price' }).click()
  await expect(page.getByText('Price saved')).toBeVisible()
}

test('a sale is recorded from a phone: existing customer, new customer, none', async ({ page }) => {
  test.setTimeout(180_000)
  await signUpWithAVariety(page)
  const created = await page.request.post('/customers', {
    data: { name: 'Marta Gómez', phone: '+5491155550011', vip: false },
  })
  expect(created.ok()).toBe(true)

  for (const customer of ['existing', 'new', 'none'] as const) {
    await page.goto(SALE_NEW)
    await fillSaleLine(page, 1, { variety: 'Jazmín', grams: '10' })
    if (customer === 'existing') {
      await page.getByRole('button', { name: 'Elegir cliente' }).click()
      await page.getByRole('button', { name: /Marta Gómez/ }).click()
    } else if (customer === 'new') {
      await page.getByRole('button', { name: 'Elegir cliente' }).click()
      await page.getByRole('button', { name: 'Nuevo cliente' }).click()
      await page.getByLabel('Teléfono').fill('+5491155550012')
      await page.getByLabel('Nombre').fill('Luz Díaz')
      await page.getByRole('button', { name: 'Crear cliente' }).click()
      // The sheets close by history, a moment after the customer is saved; until then the
      // picker's own list also names customers, so the chosen one is read once it is gone.
      await expect(page.locator('.cliente-sheet')).toHaveCount(0)
      await expect(page.locator('.lista-clientes__nombre')).toHaveText('Luz Díaz')
    }
    await page.getByRole('radio', { name: 'Cash' }).check()
    await expect(page.locator('.nueva-venta__pie')).toContainText('$ 5.000')
    await page.getByRole('button', { name: 'Guardá la venta' }).click()
    await expect(page.getByText('Sale saved')).toBeVisible()
  }
})


/** The screen's real content is up, and nothing on it is loading any more. */
async function settled(page: Page): Promise<void> {
  await expect(page.locator(LOADING_MARKER)).toHaveCount(0)
}

// One business for every case: signing up is the slow step, and each case only reads layout. The
// session cookie is kept in memory (never written to a file) and each case opens a fresh context
// from it, so no case sees another's scaling or viewport.
test.describe('phone sales sweep', () => {
  let session: Awaited<ReturnType<BrowserContext['storageState']>>

  test.beforeAll(async ({ browser, workerServer }) => {
    const context = await browser.newContext({
      ...PHONE_CONTEXT,
      baseURL: workerServer.url,
      viewport: { width: 375, height: 812 },
    })
    const page = await context.newPage()
    await signUpWithAVariety(page)
    await page.goto(SALE_NEW)
    await fillSaleLine(page, 1, { variety: 'Jazmín', grams: '10' })
    await page.getByRole('radio', { name: 'Cash' }).check()
    await page.getByRole('button', { name: 'Guardá la venta' }).click()
    await expect(page.getByText('Sale saved')).toBeVisible()
    session = await context.storageState()
    await context.close()
  })

  for (const phoneCase of CASES) {
    test(`Nueva venta, Ventas and a sale detail fit and are thumb-sized at ${phoneCase.name}`, async ({ browser, workerServer }) => {
      const context = await browser.newContext({
        ...PHONE_CONTEXT,
        baseURL: workerServer.url,
        viewport: { width: phoneCase.width, height: phoneCase.height },
        storageState: session,
      })
      try {
        await sweep(await context.newPage(), phoneCase)
      } finally {
        await context.close()
      }
    })
  }

  test.describe('the measurement rejects what it must', () => {
    async function onVentas(
      browser: Browser,
      server: WorkerServer,
      options: { phone: boolean },
    ): Promise<{ context: BrowserContext; page: Page }> {
      const context = await browser.newContext({
        baseURL: server.url,
        // `test.use` is the default of every context, so the desktop one says so itself.
        ...(options.phone ? PHONE_CONTEXT : { isMobile: false, hasTouch: false }),
        viewport: { width: 375, height: 812 },
        storageState: session,
      })
      const page = await context.newPage()
      await page.goto(SALES)
      await expect(page.locator('.fila-venta').first()).toBeVisible()
      await settled(page)
      return { context, page }
    }

    test('a screen that is still loading', async ({ browser, workerServer }) => {
      const { context, page } = await onVentas(browser, workerServer, { phone: true })
      await page.evaluate(() => document.querySelector('main')?.insertAdjacentHTML('beforeend', '<div class="cargando"></div>'))
      await expect(expectNoSidewaysOverflow(page, 'loading', TEXT_SCALE)).rejects.toThrow(/still loading/)
      await expect(expectThumbSized(page, 'loading', 1)).rejects.toThrow(/still loading/)
      await context.close()
    })

    test('an element the scaling did not reach', async ({ browser, workerServer }) => {
      const { context, page } = await onVentas(browser, workerServer, { phone: true })
      await page.evaluate(() =>
        document.querySelector('main *')?.setAttribute('style', 'font-size: 10px !important'),
      )
      await expect(expectThumbSized(page, 'uncovered', TEXT_SCALE)).rejects.toThrow(/not at baseline/)
      await context.close()
    })

    // The guards pass in these: only the measurement itself can fail.
    async function inMain(
      browser: Browser,
      server: WorkerServer,
      html: string, measure: (page: Page) => Promise<void>,
      pattern: RegExp,
    ): Promise<void> {
      const { context, page } = await onVentas(browser, server, { phone: true })
      await page.evaluate((markup) => document.querySelector('main')?.insertAdjacentHTML('beforeend', markup), html)
      await expect(measure(page)).rejects.toThrow(pattern)
      await context.close()
    }

    test('an element wider than the screen', async ({ browser, workerServer }) => {
      await inMain(
        browser,
        workerServer,
        '<div style="width: 2000px; height: 5px"></div>', (page) => expectNoSidewaysOverflow(page, 'wide', 1), /overflow/)
    })

    test('a control under 44 px', async ({ browser, workerServer }) => {
      await inMain(
        browser,
        workerServer,
        '<button type="button" style="display: block; height: 30px">Corto</button>', (page) => expectThumbSized(page, 'short', 1), /small controls/)
    })

    test('an input under 16 px, and one under 16 px × the scale', async ({ browser, workerServer }) => {
      const field = '<input aria-label="Chico" style="display: block; height: 48px; font-size: 15px" />'
      await inMain(browser, workerServer, field, (page) => expectThumbSized(page, 'unscaled', 1), /font under 16/)
      await inMain(browser, workerServer, field, (page) => expectThumbSized(page, 'scaled', TEXT_SCALE), /font under 20\.8/)
    })

    test('a page without a coarse pointer', async ({ browser, workerServer }) => {
      const { context, page } = await onVentas(browser, workerServer, { phone: false })
      await expect(expectNoSidewaysOverflow(page, 'desktop', 1)).rejects.toThrow(/coarse pointer/)
      await context.close()
    })
  })
})

async function sweep(page: Page, { name, scale }: PhoneCase): Promise<void> {
  await page.goto(SALE_NEW)
  await fillSaleLine(page, 1, { variety: 'Jazmín', grams: '10' })
  await page.getByRole('button', { name: 'Agregar otra variedad' }).click()
  await expect(page.locator('.nueva-venta__linea-total').first()).toBeVisible()
  await settled(page)
  await expectNoSidewaysOverflow(page, `${name}: Nueva venta`, scale)
  await expectThumbSized(page, `${name}: Nueva venta`, scale)
  await page.getByRole('button', { name: 'Cerrar' }).click()
  const discard = page.getByRole('alertdialog', { name: '¿Descartás la venta?' })
  await expect(discard).toBeVisible()
  await settled(page)
  await expectThumbSized(page, `${name}: the discard dialog`, scale)
  await page.getByRole('button', { name: 'Sí, descartala' }).click()

  await page.goto(SALES)
  await expect(page.locator('.fila-venta').first()).toBeVisible()
  await settled(page)
  const tabs = page.getByRole('group', { name: 'Período' })
  await expect(tabs.getByRole('button')).toHaveCount(4)
  const columns = await tabs
    .locator('.pestanas__celdas')
    .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length)
  expect([2, 4], `${name}: tab columns`).toContain(columns)
  await expectNoSidewaysOverflow(page, `${name}: Ventas`, scale)
  await expectThumbSized(page, `${name}: Ventas`, scale)

  await page.locator('.fila-venta').first().click()
  await expect(page.getByRole('button', { name: 'Borrar venta' })).toBeVisible()
  await settled(page)
  await expectNoSidewaysOverflow(page, `${name}: the detail`, scale)
  await expectThumbSized(page, `${name}: the detail`, scale)
  await page.getByRole('button', { name: 'Borrar venta' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await settled(page)
  await expectThumbSized(page, `${name}: the delete dialog`, scale)
  await page.getByRole('button', { name: 'No, dejala' }).click()
}
