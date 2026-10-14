/**
 * The pressed state (GH-77, "touch and keyboard"), measured on the built front on a
 * phone viewport, in both themes (dark by setting `data-tema`, never by emulating a
 * dark system): while a finger is down on a `.boton`, a bar item or an interactive row,
 * its computed `transform` and its fill change at once; a disabled button's do not.
 */

import { MORE, SALE_NEW, VARIETIES } from '../src/routes.js'
import { composite, contrastRatio, parseColour } from '../src/test/contrast.js'
import { expect, test } from './fixtures.js'
import type { Page } from '@playwright/test'
import { signUpNewBusiness } from './helpers/signup.js'
import { watchConsole } from './console.js'
import { fillSaleLine } from './helpers/sale.js'

interface Look {
  transform: string
  boxShadow: string
  backgroundColor: string
  color: string
  opacity: string
}

async function look(page: Page, selector: string): Promise<Look> {
  return page.locator(selector).first().evaluate((element) => {
    const { transform, boxShadow, backgroundColor, color, opacity } = getComputedStyle(element)
    return { transform, boxShadow, backgroundColor, color, opacity }
  })
}

/** The look of `selector` with the pointer down on it, and again once released. */
async function whilePressed(page: Page, selector: string): Promise<{ resting: Look; pressed: Look }> {
  const target = page.locator(selector).first()
  await expect(target).toBeVisible()
  await target.scrollIntoViewIfNeeded()
  const resting = await look(page, selector)
  const box = await target.boundingBox()
  if (box === null) throw new Error(`${selector} has no box`)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  const pressed = await look(page, selector)
  await page.mouse.move(0, 0)
  await page.mouse.up()
  return { resting, pressed }
}

function expectPressed(name: string, found: { resting: Look; pressed: Look }): void {
  expect(found.resting.transform, `${name} rests unscaled`).toBe('none')
  expect(found.pressed.transform, `${name} shrinks while pressed`).toBe('matrix(0.98, 0, 0, 0.98, 0, 0)')
  const fillChanged =
    found.pressed.boxShadow !== found.resting.boxShadow ||
    found.pressed.backgroundColor !== found.resting.backgroundColor
  expect(fillChanged, `${name} changes its fill while pressed`).toBe(true)
}

/**
 * The ratio the eye gets from a control that rests on `backdrop` (the computed, opaque
 * background of its parent): its fill and its ink both shown at the control's `opacity`.
 */
function effectiveRatio(look: Look, backdrop: string): number {
  const opacity = Number(look.opacity)
  const ground = parseColour(backdrop)
  const fill = composite(parseColour(look.backgroundColor), opacity, ground)
  const ink = composite(parseColour(look.color), opacity, fill)
  return contrastRatio(ink, fill)
}

test.use({ viewport: { width: 390, height: 844 } })

for (const theme of ['claro', 'oscuro'] as const) {
  test(`a press shows at once on a button, a bar item and a row (${theme})`, async ({ page }) => {
    const messages: string[] = []
    watchConsole(page, messages)

    await signUpNewBusiness(page, { businessName: `Flores del Toque ${theme} ${Date.now()}`, email: `duena-toque-${theme}-${Date.now()}@example.com` })

    await page.goto(MORE)
    await page.evaluate((value) => {
      if (value === 'oscuro') document.documentElement.setAttribute('data-tema', value)
    }, theme)

    expectPressed('the bar item', await whilePressed(page, '.bar-inferior__item'))
    expectPressed('the Más row', await whilePressed(page, '.mas__item'))

    await page.evaluate(() => {
      const button = document.createElement('button')
      button.className = 'boton'
      button.id = 'prueba-boton'
      button.textContent = 'Prueba'
      document.querySelector('.cuerpo')?.append(button)
      const disabled = button.cloneNode(true) as HTMLButtonElement
      disabled.id = 'prueba-boton-inactivo'
      disabled.disabled = true
      document.querySelector('.cuerpo')?.append(disabled)
    })
    expectPressed('the button', await whilePressed(page, '#prueba-boton'))

    const inactive = await whilePressed(page, '#prueba-boton-inactivo')
    expect(inactive.pressed.transform, 'a disabled button stays unscaled').toBe('none')
    expect(inactive.pressed.boxShadow).toBe(inactive.resting.boxShadow)

    expect(messages).toEqual([])
  })
  test(`Deshacer keeps 4.5:1 at rest and while pressed (${theme})`, async ({ page }) => {
    await signUpNewBusiness(page, { businessName: `Flores del Deshacer ${theme} ${Date.now()}`, email: `duena-deshacer-${theme}-${Date.now()}@example.com` })
    await page.goto(VARIETIES)
    await page.getByRole('link', { name: 'Nueva variedad' }).click()
    await page.getByLabel('Nombre').fill('Rosa')
    await page.getByRole('button', { name: 'Agregá la variedad' }).click()
    await expect(page.getByText('Variedad guardada')).toBeVisible()
    await page.getByRole('link', { name: /Rosa/ }).click()
    await page.getByRole('link', { name: 'Nuevo precio' }).click()
    await page.getByLabel(/^Precio de lista/).fill('1000')
    await page.getByRole('button', { name: 'Guardá el precio' }).click()
    await expect(page.getByText('Precio guardado')).toBeVisible()

    await page.goto(SALE_NEW)
    await page.evaluate((value) => {
      if (value === 'oscuro') document.documentElement.setAttribute('data-tema', value)
    }, theme)
    // The notice lasts 5 s (`UNDO_WINDOW_MS`): time runs for the save, then stops once the
    // notice is up, so it cannot go while the button is read.
    await page.clock.install()
    await fillSaleLine(page, 1, { variety: 'Rosa', grams: '2' })
    await page.getByRole('radio', { name: 'Efectivo' }).check()
    await page.getByRole('button', { name: 'Guardá la venta' }).click()
    await expect(page.getByText('Venta guardada')).toBeVisible()
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 50)

    const found = await whilePressed(page, '.venta-guardada .boton--enlace')
    const backdrop = await page.locator('.venta-guardada').evaluate((bar) => getComputedStyle(bar).backgroundColor)
    expect(effectiveRatio(found.resting, backdrop), 'Deshacer at rest').toBeGreaterThanOrEqual(4.5)
    expect(effectiveRatio(found.pressed, backdrop), 'Deshacer while pressed').toBeGreaterThanOrEqual(4.5)
    expectPressed('Deshacer', found)

    await expect(page.getByText('Venta guardada')).toBeVisible()
    await expect(page.getByText('Venta eliminada · los gramos vuelven al stock')).toHaveCount(0)
  })
}
