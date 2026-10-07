/**
 * The sales screens on a real phone browser, end to end (GH-78, subtask "nv-loading"): a sale is
 * recorded in under a minute with an existing customer, with a new one made from inside the
 * sheet and with none; and at 320, 375 and 430 px, and at 130 % text (the same widths divided by
 * 1.3, what text zoom does to the CSS viewport), Nueva venta, Ventas and a sale's detail
 * (dialogs included) overflow nowhere sideways, every interactive element is at least 44 px
 * tall, every input at least 16 px, and Ventas' tabs sit in two or four columns, never three.
 */

import { SALE_NEW, SALES, VARIETIES } from '../src/routes.js'
import { expect, test, type Page } from '@playwright/test'
import { signUpNewBusiness } from './helpers/signup.js'
import { fillSaleLine } from './helpers/sale.js'

const ONE_MINUTE = 60_000
const TOUCH_TARGET = 44
const MIN_INPUT_FONT = 16
const PHONES = [
  { name: '320', width: 320, height: 720 },
  { name: '375', width: 375, height: 812 },
  { name: '430', width: 430, height: 900 },
  { name: '320 at 130 %', width: 246, height: 720 },
  { name: '430 at 130 %', width: 331, height: 900 },
]

test.use({ isMobile: true, hasTouch: true, viewport: { width: 375, height: 812 } })

async function signUpWithAVariety(page: Page): Promise<void> {
  await signUpNewBusiness(page, { businessName: `Vivero Telefono ${Date.now()}`, email: `telefono-venta-${Date.now()}@example.com` })
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'Nueva variedad' }).click()
  await page.getByLabel('Nombre').fill('Jazmín')
  await page.getByRole('button', { name: 'Agregá la variedad' }).click()
  await expect(page.getByText('Variedad guardada')).toBeVisible()
  await page.getByRole('link', { name: /Jazmín/ }).click()
  await page.getByRole('link', { name: 'Nuevo precio' }).click()
  await page.getByLabel('Rige desde').fill('2000-01-01')
  await page.getByLabel(/^Precio de lista/).fill('500')
  await page.getByRole('button', { name: 'Guardá el precio' }).click()
  await expect(page.getByText('Precio guardado')).toBeVisible()
}

async function expectNoSidewaysOverflow(page: Page, where: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const width = document.documentElement.clientWidth
    const out = [...document.querySelectorAll('main *')]
      .filter((node) => node.closest('.cargando__anuncio') === null)
      .filter((node) => node.getBoundingClientRect().right > width + 0.5)
      .map((node) => `${node.tagName}.${node.className}`)
    return { page: document.documentElement.scrollWidth - width, out }
  })
  expect(overflow, `${where}: overflow`).toEqual({ page: 0, out: [] })
}

/** Every visible control (button, link, radio, field) at least 44 px tall, and every field's text
 * at least 16 px. Hidden announcers and a native control a styled switch stands in for are left
 * out: they are not what a thumb lands on. */
async function expectThumbSized(page: Page, where: string): Promise<void> {
  const small = await page.evaluate(
    ({ target, font }) => {
      const found: string[] = []
      const controls = document.querySelectorAll(
        'button, a[href], [role="radio"], [role="switch"], input:not([type="checkbox"]):not([type="radio"]), select, textarea',
      )
      for (const node of controls) {
        const rect = node.getBoundingClientRect()
        if (rect.width <= 1 || rect.height <= 1) continue
        const label = `${node.tagName} ${node.getAttribute('aria-label') ?? node.textContent?.slice(0, 24) ?? ''}`
        if (rect.height < target - 0.5) found.push(`${label}: ${Math.round(rect.height)} px tall`)
        if (/^(INPUT|SELECT|TEXTAREA)$/.test(node.tagName) && parseFloat(getComputedStyle(node).fontSize) < font) {
          found.push(`${label}: font under ${font}`)
        }
      }
      return found
    },
    { target: TOUCH_TARGET, font: MIN_INPUT_FONT },
  )
  expect(small, `${where}: small controls`).toEqual([])
}

test('a sale is recorded in under a minute from a phone: existing customer, new customer, none', async ({ page }) => {
  test.setTimeout(180_000)
  await signUpWithAVariety(page)
  const created = await page.request.post('/customers', {
    data: { name: 'Marta Gómez', phone: '+5491155550011', channel: null, vip: false },
  })
  expect(created.ok()).toBe(true)

  for (const customer of ['existing', 'new', 'none'] as const) {
    const started = Date.now()
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
    await page.getByRole('radio', { name: 'Efectivo' }).check()
    await expect(page.locator('.nueva-venta__pie')).toContainText('$ 5.000')
    await page.getByRole('button', { name: 'Guardá la venta' }).click()
    await expect(page.getByText('Venta guardada')).toBeVisible()
    expect(Date.now() - started, `${customer}: seconds to record`).toBeLessThan(ONE_MINUTE)
  }
})

test('Nueva venta, Ventas and a sale detail fit and are thumb-sized at every phone width and at 130 %', async ({
  page,
}) => {
  test.setTimeout(240_000)
  await signUpWithAVariety(page)
  await page.goto(SALE_NEW)
  await fillSaleLine(page, 1, { variety: 'Jazmín', grams: '10' })
  await page.getByRole('radio', { name: 'Efectivo' }).check()
  await page.getByRole('button', { name: 'Guardá la venta' }).click()
  await expect(page.getByText('Venta guardada')).toBeVisible()

  for (const phone of PHONES) {
    await page.setViewportSize({ width: phone.width, height: phone.height })

    await page.goto(SALE_NEW)
    await fillSaleLine(page, 1, { variety: 'Jazmín', grams: '10' })
    await page.getByRole('button', { name: 'Agregar otra variedad' }).click()
    await expectNoSidewaysOverflow(page, `${phone.name}: Nueva venta`)
    await expectThumbSized(page, `${phone.name}: Nueva venta`)
    await page.getByRole('button', { name: 'Cerrar' }).click()
    await expect(page.getByRole('alertdialog', { name: '¿Descartás la venta?' })).toBeVisible()
    await expectThumbSized(page, `${phone.name}: the discard dialog`)
    await page.getByRole('button', { name: 'Sí, descartala' }).click()

    await page.goto(SALES)
    const tabs = page.getByRole('group', { name: 'Período' })
    await expect(tabs.getByRole('button')).toHaveCount(4)
    const columns = await tabs
      .locator('.pestanas__celdas')
      .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length)
    expect([2, 4], `${phone.name}: tab columns`).toContain(columns)
    await expectNoSidewaysOverflow(page, `${phone.name}: Ventas`)
    await expectThumbSized(page, `${phone.name}: Ventas`)

    await page.locator('.fila-venta').first().click()
    await expect(page.getByRole('button', { name: 'Borrar venta' })).toBeVisible()
    await expectNoSidewaysOverflow(page, `${phone.name}: the detail`)
    await expectThumbSized(page, `${phone.name}: the detail`)
    await page.getByRole('button', { name: 'Borrar venta' }).click()
    await expectThumbSized(page, `${phone.name}: the delete dialog`)
    await page.getByRole('button', { name: 'No, dejala' }).click()
  }
})
