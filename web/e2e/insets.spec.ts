/**
 * The safe-area insets (GH-77, "insets"), measured on the built front with the four
 * tokens forced to a notch and a home bar: top 47, bottom 34, left and right 44.
 * Equality, not "at least", for what sits in the flow: an element whose top moves by
 * more than 47 has the inset applied twice, one that moves by less has none.
 * Chromium reports no safe area of its own, so the tokens are overridden in a style
 * element that each check can add and remove.
 */

import { expect, test, type Page } from '@playwright/test'
import { newBusinessInvitationUrl } from './backend.js'
import { watchConsole } from './console.js'
import { fillSaleLine } from './helpers/sale.js'

const PASSWORD = 'correcthorsebattery'
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
    await page.goto('/entrar')
    const moved = await shift(page, '.marca')
    expect(moved.top, `${viewport.name}: /entrar top`).toBe(TOP)
  }

  await page.setViewportSize(VIEWPORTS[0])
  await page.goto(newBusinessInvitationUrl())
  await page.getByLabel('Nombre del negocio').fill(`Flores del Borde ${Date.now()}`)
  await page.getByLabel('Email').fill(`duena-bordes-${Date.now()}@example.com`)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Creá el negocio' }).click()
  await expect(page.locator('.encabezado__negocio')).toBeVisible()

  await page.goto('/variedades')
  await page.getByRole('button', { name: 'Nueva variedad' }).click()
  await page.getByLabel('Nombre').fill('Rosa')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Variedad guardada')).toBeVisible()
  await page.getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('button', { name: 'Nuevo precio' }).click()
  await page.getByLabel('Precio de lista').fill('1000')
  await page.getByRole('button', { name: 'Guardar precio' }).click()
  await expect(page.getByText('Precio guardado')).toBeVisible()

  await page.goto('/clientes/nuevo')
  await page.getByLabel('Teléfono').fill('+5491155550077')
  await page.getByLabel('Nombre').fill('Lucía Borde')
  await page.getByRole('button', { name: 'Guardá y usá' }).click()
  await expect(page).toHaveURL(/\/clientes$/)
  await page.getByRole('link', { name: 'Lucía Borde' }).click()
  await page.getByRole('link', { name: 'Nueva venta a Lucía Borde' }).click()
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '5' })
  await page.getByRole('radio', { name: 'Debiendo' }).check()
  await page.getByRole('button', { name: 'Guardá la venta' }).click()
  await expect(page).toHaveURL(/\/ventas\/\d+$/)
  const saleUrl = new URL(page.url()).pathname

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport)
    const where = (what: string) => `${viewport.name}: ${what}`

    // The sales list: a nested `.pantalla` inside the shell, which owns the insets.
    await page.goto('/ventas')
    const list = await shift(page, '.encabezado__titulo')
    expect(list.top, where('/ventas top')).toBe(TOP)
    if (!viewport.wide) expect(list.left, where('/ventas left')).toBe(SIDE)
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
    expect(detailEnd.bottom, where('detail bottom')).toBeLessThanOrEqual(viewport.height - BOTTOM)

    // Nueva venta: the save button, and the customer sheet over it.
    await page.goto('/ventas/nueva')
    // The row, not its title: the title is centered in a row whose height follows the
    // narrower content width, so it moves by less than the inset.
    const form = await shift(page, '.encabezado-fila')
    expect(form.top, where('nueva venta top')).toBe(TOP)
    if (!viewport.wide) expect(form.left, where('nueva venta left')).toBe(SIDE)
    await scrollToEnd(page)
    const save = await box(page, 'button:has-text("Guardá la venta")')
    expect(save.bottom, where('Guardá la venta')).toBeLessThanOrEqual(viewport.height - BOTTOM)

    await page.getByRole('button', { name: 'Elegir cliente' }).click()
    const sheetButton = page.locator('.cliente-sheet__contenido button').last()
    await sheetButton.scrollIntoViewIfNeeded()
    expectInside(where('customer sheet button'), await box(page, '.cliente-sheet__contenido button', 'last'), viewport)

    // Registrar cobro over the customer's card.
    await page.goto('/clientes')
    await page.getByRole('link', { name: 'Lucía Borde' }).click()
    await page.getByRole('button', { name: 'Registrar cobro' }).click()
    await setInsets(page, true)
    await page.locator('.capa__contenido button').last().scrollIntoViewIfNeeded()
    expectInside(where('cobro sheet button'), await box(page, '.capa__contenido button', 'last'), viewport)

    // A toast: the offline notice is the one that needs no timing.
    await page.context().setOffline(true)
    await expect(page.locator('.aviso-flotante')).toBeVisible()
    const toast = await box(page, '.aviso-flotante')
    expect(toast.top, where('toast top')).toBeGreaterThanOrEqual(TOP + TOAST_MARGIN)
    expect(toast.left, where('toast left')).toBeGreaterThanOrEqual(SIDE + TOAST_MARGIN)
    expect(toast.right, where('toast right')).toBeLessThanOrEqual(viewport.width - SIDE - TOAST_MARGIN)
    await page.context().setOffline(false)
  }

  expect(consoleMessages).toEqual([])
})
