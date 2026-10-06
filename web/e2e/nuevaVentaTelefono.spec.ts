/**
 * Nueva venta's phone shell, in a real phone browser (GH-78, `nv-shell`): the fixed header, the
 * scrolling body and the footer pinned to the visual viewport. jsdom loads no stylesheet, so the
 * layout is proven here: at 320, 375 and 430 px and at 130 % text (a 246 px-wide viewport, the
 * width the mobile audit measured) the footer's total and "Guardá la venta" are on screen on
 * load, the header stays put while the body scrolls, how it was paid and the Debiendo hint
 * scroll fully above the footer with the screen's side margin, a shortened viewport (the
 * keyboard's stand-in: headless Chromium has no on-screen keyboard) leaves the footer in view,
 * and nothing overflows sideways. The real keyboard on iOS and Android is checked by eye
 * before merge (ADR-0028).
 */

import { expect, test, type Locator, type Page } from '@playwright/test'
import { newBusinessInvitationUrl } from './backend.js'

const PASSWORD = 'correcthorsebattery'
const WIDTHS = [320, 375, 430, 246] as const
const HEIGHT = 700

test.use({ isMobile: true, hasTouch: true, viewport: { width: 375, height: HEIGHT } })

interface Box {
  x: number
  y: number
  width: number
  height: number
}

async function box(locator: Locator): Promise<Box> {
  const found = await locator.boundingBox()
  if (found === null) throw new Error('the element has no box on screen')
  return found
}

async function signInWithAPricedVariety(page: Page): Promise<void> {
  await page.goto(newBusinessInvitationUrl())
  await page.getByLabel('Nombre del negocio').fill(`Vivero Telefono ${Date.now()}`)
  await page.getByLabel('Email').fill(`telefono-${Date.now()}@example.com`)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Creá el negocio' }).click()
  await expect(page.locator('.encabezado__negocio')).toBeVisible()
  await page.goto('/variedades')
  await page.getByRole('button', { name: 'Nueva variedad' }).click()
  await page.getByLabel('Nombre').fill('Jazmín')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Variedad guardada')).toBeVisible()
  await page.getByRole('link', { name: /Jazmín/ }).click()
  await page.getByRole('button', { name: 'Nuevo precio' }).click()
  await page.getByLabel('Rige desde').fill('2000-01-01')
  await page.getByLabel('Precio de lista').fill('500')
  await page.getByRole('button', { name: 'Guardar precio' }).click()
  await expect(page.getByText('Precio guardado')).toBeVisible()
}

/** Nothing the shell owns (header, customer, shipping, note, payment, footer) reaches past the
 * screen's edge. A line's own fields are `nv-line-phone`'s, and the sweep over them is
 * `nv-loading`'s: they are left out here so this spec says only what this piece guarantees. */
async function expectShellFitsTheScreen(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const out = [...document.querySelectorAll('form.nueva-venta *')]
      .filter((node) => node.closest('.nueva-venta__lineas') === null)
      .filter((node) => node.getBoundingClientRect().right > window.innerWidth + 0.5)
      .map((node) => `${node.tagName}.${node.className}`)
    return { page: document.documentElement.scrollWidth - window.innerWidth, out }
  })
  expect(overflow).toEqual({ page: 0, out: [] })
}

test('the form is three zones at every phone width: footer in view, header fixed, payment last above the footer', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await signInWithAPricedVariety(page)

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: HEIGHT })
    await page.goto('/ventas/nueva')
    const save = page.getByRole('button', { name: 'Guardá la venta' })
    await expect(save).toBeVisible()

    // The footer's total and button are on screen on load, no scrolling.
    const footer = page.locator('.nueva-venta__pie')
    const footerBox = await box(footer)
    expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(HEIGHT)
    await expect(footer.getByText('Total')).toBeInViewport()
    await expect(save).toBeInViewport()

    // Header: the date input is 16 px or more and 44 px or more tall.
    const date = page.getByLabel('Fecha')
    expect(await date.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16)
    expect((await box(date)).height).toBeGreaterThanOrEqual(44)

    // The payment options are at least 44 px tall.
    for (const option of await page.getByRole('radio').all()) {
      expect((await box(option)).height).toBeGreaterThanOrEqual(44)
    }

    // Enough lines to make the body scroll; the header stays where it was.
    const header = page.locator('.nueva-venta__cabecera')
    const before = await box(header)
    for (let line = 0; line < 4; line += 1) {
      await page.getByRole('button', { name: 'Agregar otra variedad' }).click()
    }
    const scroller = page.locator('.nueva-venta__disposicion')
    await scroller.evaluate((node) => {
      node.scrollTop = node.scrollHeight
    })
    expect(await box(header)).toEqual(before)

    // Scrolled to the end: how it was paid and the Debiendo hint sit fully above the footer,
    // with the screen's own side margin, never at x = 0.
    const hint = page.getByText('Para dejar debiendo elegí un cliente')
    const hintBox = await box(hint)
    expect(hintBox.x).toBeGreaterThan(0)
    expect(hintBox.y + hintBox.height).toBeLessThanOrEqual((await box(footer)).y)
    const group = await box(page.getByRole('radiogroup', { name: 'Cómo se pagó' }))
    expect(group.y + group.height).toBeLessThanOrEqual((await box(footer)).y)

    await expectShellFitsTheScreen(page)
  }
})

test('with the viewport shortened the footer stays in view, and the keyboard flag drops the grams line', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await signInWithAPricedVariety(page)
  await page.goto('/ventas/nueva')
  const save = page.getByRole('button', { name: 'Guardá la venta' })
  await expect(save).toBeVisible()
  const grams = page.getByText('vendidos')
  await expect(grams).toBeVisible()

  await page.setViewportSize({ width: 375, height: 380 })
  await expect(save).toBeInViewport()
  await expect(page.getByLabel('Fecha')).toBeInViewport()

  // Headless Chromium has no on-screen keyboard: the flag the visual-viewport hook sets is
  // set by hand, to see what the stylesheet does under it.
  await page.locator('form.nueva-venta').evaluate((node) => node.setAttribute('data-teclado', 'abierto'))
  await expect(grams).toBeHidden()
  await expect(page.locator('.nueva-venta__pie').getByText('Total')).toBeVisible()
  await expect(save).toBeInViewport()
})
