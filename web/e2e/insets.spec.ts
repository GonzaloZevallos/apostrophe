/**
 * The safe-area insets (GH-77, "insets"), measured on the built front with the four
 * tokens forced to a notch and a home bar: top 47, bottom 34, left and right 44.
 * Equality, not "at least", for what sits in the flow: an element whose top moves by
 * more than 47 has the inset applied twice, one that moves by less has none.
 * Chromium reports no safe area of its own, so the tokens are overridden in a style
 * element that each check can add and remove.
 */

import { expect, test } from './fixtures.js'
import { expectToast } from './helpers/toast.js'
import type { Page } from '@playwright/test'
import {
  CUSTOMER,
  CUSTOMER_NEW,
  CUSTOMERS,
  EXPENSE_CATEGORIES,
  LOGIN,
  SALE,
  SALE_NEW,
  SALES,
  SETTINGS_ACCOUNT,
  SETTINGS_APPEARANCE,
  SETTINGS_BUSINESS,
  SETTINGS_CATALOG_MESSAGE,
  SETTINGS_INTEGRATIONS,
  SETTINGS_PRICES,
  SETTINGS_USERS,
  VARIETIES,
} from '../src/routes.js'
import { expectPath } from './helpers/url.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { watchConsole } from './console.js'
import { fillSaleLine } from './helpers/sale.js'
import { uniqueTag } from './helpers/unique.js'

const TOP = 47
const BOTTOM = 34
const SIDE = 44
/** `--espacio-md`, the toast's normal distance from the edge. */
const TOAST_MARGIN = 12

const VIEWPORTS = [
  { name: 'phone portrait', width: 390, height: 844, wide: false },
  { name: 'phone landscape', width: 844, height: 390, wide: false },
  { name: 'computer', width: 1280, height: 900, wide: true },
] as const

interface Box {
  top: number
  left: number
  right: number
  bottom: number
}

async function setInsets(page: Page, on: boolean): Promise<void> {
  await page.evaluate(
    ({ on, top, bottom, side }) => {
      document.getElementById('insets-under-test')?.remove()
      if (!on) return
      const style = document.createElement('style')
      style.id = 'insets-under-test'
      style.textContent = `html:root{--inset-arriba:${top}px;--inset-abajo:${bottom}px;--inset-izquierda:${side}px;--inset-derecha:${side}px}`
      document.head.append(style)
    },
    { on, top: TOP, bottom: BOTTOM, side: SIDE },
  )
}

async function box(page: Page, selector: string, which: 'first' | 'last' = 'first'): Promise<Box> {
  const target = which === 'first' ? page.locator(selector).first() : page.locator(selector).last()
  return target.evaluate((element) => {
    const { top, left, right, bottom } = element.getBoundingClientRect()
    return { top, left, right, bottom }
  })
}

/** How far `selector` moves, at the top of the page, when the insets turn on. */
async function shift(page: Page, selector: string): Promise<{ top: number; left: number }> {
  await expect(page.locator(selector).first()).toBeVisible()
  await setInsets(page, false)
  const before = await box(page, selector)
  await setInsets(page, true)
  const after = await box(page, selector)
  return { top: after.top - before.top, left: after.left - before.left }
}

async function scrollToEnd(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
}

function expectInside(name: string, found: Box, viewport: { width: number; height: number }): void {
  expect(found.top, `${name} top`).toBeGreaterThanOrEqual(TOP)
  expect(found.left, `${name} left`).toBeGreaterThanOrEqual(SIDE)
  expect(found.right, `${name} right`).toBeLessThanOrEqual(viewport.width - SIDE)
  expect(found.bottom, `${name} bottom`).toBeLessThanOrEqual(viewport.height - BOTTOM)
}

test('every screen, bar, sheet and toast keeps clear of the notch and the home bar', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)

  // Signed out: the sign-in screen is its own root, and owns all four sides.
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport)
    await page.goto(LOGIN)
    const moved = await shift(page, '.marca')
    expect(moved.top, `${viewport.name}: /entrar top`).toBe(TOP)
  }

  await page.setViewportSize(VIEWPORTS[0])
  await signUpNewBusiness(page, { businessName: `Flores del Borde ${uniqueTag()}`, email: `duena-bordes-${uniqueTag()}@example.com` })

  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'New variety' }).click()
  await page.getByLabel('Name').fill('Rosa')
  await expectToast(page, 'Variety saved', () => page.getByRole('button', { name: 'Add the variety' }).click())
  await page.getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('link', { name: 'New price' }).click()
  await page.getByLabel(/^List price/).fill('1000')
  await expectToast(page, 'Price saved', () => page.getByRole('button', { name: 'Save the price' }).click())

  await page.goto(CUSTOMER_NEW)
  await page.getByLabel('Phone').fill('+5491155550077')
  await page.getByLabel('Name').fill('Lucía Borde')
  await page.getByRole('button', { name: 'Save and use' }).click()
  await expectPath(page, CUSTOMER)
  await page.getByRole('link', { name: 'New sale to Lucía Borde' }).click()
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '5' })
  await page.getByRole('radio', { name: 'Owing' }).check()
  await page.getByRole('button', { name: 'Save sale' }).click()
  await expectPath(page, SALE)
  const saleUrl = new URL(page.url()).pathname

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport)
    const where = (what: string) => `${viewport.name}: ${what}`

    // The sales list: a nested `.pantalla` inside the shell, which owns the insets.
    await page.goto(SALES)
    const list = await shift(page, '.encabezado__titulo')
    expect(list.top, where('sales top')).toBe(TOP)
    if (!viewport.wide) expect(list.left, where('sales left')).toBe(SIDE)
    else expect((await shift(page, '.riel-lateral')).left, where('rail left')).toBe(SIDE)

    if (!viewport.wide) {
      await scrollToEnd(page)
      const bar = await box(page, '.bar-inferior')
      expect(bar.left, where('bar left edge')).toBe(0)
      expect(bar.right, where('bar right edge')).toBe(viewport.width)
      const first = await box(page, '.bar-inferior__item', 'first')
      const last = await box(page, '.bar-inferior__item', 'last')
      expect(first.left, where('bar first item')).toBeGreaterThanOrEqual(SIDE)
      expect(last.right, where('bar last item')).toBeLessThanOrEqual(viewport.width - SIDE)
      expect(last.bottom, where('bar bottom')).toBeLessThanOrEqual(viewport.height - BOTTOM)
    }

    // A sale's detail: no bar below, the column keeps clear of the home bar.
    await page.goto(saleUrl)
    const detail = await shift(page, '.encabezado__titulo')
    expect(detail.top, where('detail top')).toBe(TOP)
    if (!viewport.wide) expect(detail.left, where('detail left')).toBe(SIDE)
    await scrollToEnd(page)
    const detailEnd = await box(page, '.cuerpo')
    // The page scrolls by whole pixels while its height can be fractional (590.1875 in
    // landscape), so the end can sit up to a pixel short of the bottom: under 1 px is no overlap.
    expect(detailEnd.bottom, where('detail bottom')).toBeLessThan(viewport.height - BOTTOM + 1)

    // Nueva venta: the save button, and the customer sheet over it.
    await page.goto(SALE_NEW)
    // The row, not its title: the title is centered in a row whose height follows the
    // narrower content width, so it moves by less than the inset.
    const form = await shift(page, '.encabezado-fila')
    expect(form.top, where('nueva venta top')).toBe(TOP)
    if (!viewport.wide) expect(form.left, where('nueva venta left')).toBe(SIDE)
    await scrollToEnd(page)
    const save = await box(page, 'button:has-text("Save sale")')
    expect(save.bottom, where('Save sale')).toBeLessThanOrEqual(viewport.height - BOTTOM)

    await page.getByRole('button', { name: 'Pick a customer' }).click()
    const sheetButton = page.locator('.cliente-sheet__contenido button').last()
    await sheetButton.scrollIntoViewIfNeeded()
    expectInside(where('customer sheet button'), await box(page, '.cliente-sheet__contenido button', 'last'), viewport)

    // Registrar cobro, opened from Clientes' "Cobrar a": a form screen, a modal on a computer.
    await page.goto(CUSTOMERS)
    await page.getByRole('link', { name: 'Collect from Lucía Borde' }).first().click()
    await setInsets(page, true)
    await page.getByRole('button', { name: 'Save' }).evaluate((button) => {
      for (let el: Element | null = button; el; el = el.parentElement) el.scrollTop = el.scrollHeight
    })
    expectInside(where('cobro form button'), await box(page, 'button:has-text("Save")'), viewport)

    // A toast: the offline notice is the one that needs no timing.
    await page.context().setOffline(true)
    await expect(page.locator('.aviso-flotante')).toBeVisible()
    const toast = await box(page, '.aviso-flotante')
    // Below 900 px the toast moved from the top to sit above the bar and the pinned action.
    if (viewport.wide) expect(toast.top, where('toast top')).toBeGreaterThanOrEqual(TOP + TOAST_MARGIN)
    else expect(toast.bottom, where('toast bottom')).toBeLessThanOrEqual(viewport.height - BOTTOM - TOAST_MARGIN)
    expect(toast.left, where('toast left')).toBeGreaterThanOrEqual(SIDE + TOAST_MARGIN)
    expect(toast.right, where('toast right')).toBeLessThanOrEqual(viewport.width - SIDE - TOAST_MARGIN)
    await page.context().setOffline(false)
  }

  expect(consoleMessages).toEqual([])
})

/** `.ajustes-grupo`'s own top padding on a computer, `app.css`'s 80px: what `844942f` computed. */
const SETTINGS_GROUP_TOP = '80px'

test('a settings group on a computer keeps its 80px top padding at inset 0 and still clears the notch', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)

  await page.setViewportSize(VIEWPORTS[2])
  await signUpNewBusiness(page, {
    businessName: `Flores del Margen ${uniqueTag()}`,
    email: `duena-margen-${uniqueTag()}@example.com`,
  })

  const groups = [
    SETTINGS_BUSINESS,
    SETTINGS_USERS,
    SETTINGS_INTEGRATIONS,
    SETTINGS_PRICES,
    SETTINGS_CATALOG_MESSAGE,
    EXPENSE_CATEGORIES,
    SETTINGS_ACCOUNT,
    SETTINGS_APPEARANCE,
  ]
  for (const group of groups) {
    await page.goto(group)
    await expect(page.locator('.ajustes-grupo__tarjeta')).toBeVisible()
    await setInsets(page, false)
    // Polled: a group that loads its data first swaps its card once, when the answer lands.
    await expect
      .poll(
        () =>
          page.locator('.ajustes-grupo').evaluate((element) => getComputedStyle(element).paddingTop),
        { message: `${group}: padding-top at inset 0` },
      )
      .toBe(SETTINGS_GROUP_TOP)

    // The shell owns the top inset: the card moves by the notch, no more and no less.
    const moved = await shift(page, '.ajustes-grupo__tarjeta')
    expect(moved.top, `${group}: card top`).toBe(TOP)
  }

  expect(consoleMessages).toEqual([])
})
