/**
 * The pressed state (GH-77, "touch and keyboard"), measured on the built front on a
 * phone viewport, in both themes (dark by setting `data-tema`, never by emulating a
 * dark system): while a finger is down on a `.boton`, a bar item or an interactive row,
 * its computed `transform` and its fill change at once; a disabled button's do not.
 */

import { expect, test, type Page } from '@playwright/test'
import { newBusinessInvitationUrl } from './backend.js'
import { watchConsole } from './console.js'

const PASSWORD = 'correcthorsebattery'

interface Look {
  transform: string
  boxShadow: string
  backgroundColor: string
}

async function look(page: Page, selector: string): Promise<Look> {
  return page.locator(selector).first().evaluate((element) => {
    const { transform, boxShadow, backgroundColor } = getComputedStyle(element)
    return { transform, boxShadow, backgroundColor }
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

test.use({ viewport: { width: 390, height: 844 } })

for (const theme of ['claro', 'oscuro'] as const) {
  test(`a press shows at once on a button, a bar item and a row (${theme})`, async ({ page }) => {
    const messages: string[] = []
    watchConsole(page, messages)

    await page.goto(newBusinessInvitationUrl())
    await page.getByLabel('Nombre del negocio').fill(`Flores del Toque ${theme} ${Date.now()}`)
    await page.getByLabel('Email').fill(`duena-toque-${theme}-${Date.now()}@example.com`)
    await page.getByLabel('Contraseña').fill(PASSWORD)
    await page.getByRole('button', { name: 'Creá el negocio' }).click()
    await expect(page.locator('.encabezado__negocio')).toBeVisible()

    await page.goto('/mas')
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
}
