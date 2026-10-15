/**
 * The pressed state (GH-77, GH-102, "touch and keyboard"), measured on the built front, in
 * both themes (dark by setting `data-tema`, never by emulating a dark system): while a finger
 * is down on a control, its computed `transform` and its fill change at once; a disabled
 * button's do not.
 *
 * It is the backstop of `src/architecture/touch.test.ts`, which finds every tappable control
 * in the markup and reads the stylesheet. This one is the authority on what a person sees,
 * but it runs on an empty business, so it covers chrome and settings only: the bar, the
 * tabs, Más, Configuración's list, Tu cuenta, Apariencia, Inicio's first-run controls, the
 * computer sidebar with its business row, and Entrar signed out. List rows (sales, expenses,
 * customers, varieties) are covered by the static scan and by eye.
 */

import {
  CUSTOMERS,
  HOME,
  LOGIN,
  MORE,
  SALE_NEW,
  SALES,
  SETTINGS,
  SETTINGS_ACCOUNT,
  SETTINGS_APPEARANCE,
  VARIETIES,
} from '../src/routes.js'
import { EXEMPT } from '../src/architecture/pressedExempt.js'
import { composite, contrastRatio, parseColour } from '../src/test/contrast.js'
import { expect, test } from './fixtures.js'
import type { Page } from '@playwright/test'
import { signUpNewBusiness } from './helpers/signup.js'
import { watchConsole } from './console.js'
import { fillSaleLine } from './helpers/sale.js'

const PHONE = { width: 390, height: 844 }
const COMPUTER = { width: 1280, height: 920 }
const PER_CLASS_SET = 3
const CONTROLS = 'button, a[href], [role=button], [role=tab], [role=radio], [role=switch]'
const EXEMPT_CLASSES = EXEMPT.flatMap((entry) => entry.classes)
const THEMES = ['claro', 'oscuro'] as const

interface Look {
  transform: string
  boxShadow: string
  /** The element's own fill, or the first non-transparent ancestor's when its own is transparent. */
  fill: string
  /** Its own computed fill, ink and opacity, for the contrast reading of a pressed control. */
  backgroundColor: string
  color: string
  opacity: string
}

interface Probe {
  look: Look
  x: number
  y: number
  covered: boolean
}

/**
 * One round trip: the first match of `selector`, optionally scrolled to the centre of the
 * view, with its transform, ring and effective resting fill, where a press on it would land,
 * and whether something else covers that point.
 */
async function probe(page: Page, selector: string, scroll: boolean): Promise<Probe> {
  return page.locator(selector).first().evaluate((element, scrollFirst) => {
    if (scrollFirst) element.scrollIntoView({ block: 'center', inline: 'center' })
    const { transform, boxShadow, backgroundColor, color, opacity } = getComputedStyle(element)
    let fill = 'rgba(0, 0, 0, 0)'
    for (let node: Element | null = element; node !== null; node = node.parentElement) {
      const own = getComputedStyle(node).backgroundColor
      if (own !== 'rgba(0, 0, 0, 0)' && own !== 'transparent') {
        fill = own
        break
      }
    }
    const box = element.getBoundingClientRect()
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    return { look: { transform, boxShadow, fill, backgroundColor, color, opacity }, x, y, covered: !element.contains(document.elementFromPoint(x, y)) }
  }, scroll)
}

/**
 * The look of `selector` at rest and with the pointer down on it (moved away before the
 * release, so no click fires). A press on something that covers it is an error.
 */
async function whilePressed(page: Page, selector: string): Promise<{ resting: Look; pressed: Look }> {
  const resting = await probe(page, selector, true)
  if (resting.covered) throw new Error(`${selector} is covered at its centre, so a press would land on something else`)
  await page.mouse.move(resting.x, resting.y)
  await page.mouse.down()
  const pressed = await probe(page, selector, false)
  await page.mouse.move(0, 0)
  await page.mouse.up()
  return { resting: resting.look, pressed: pressed.look }
}

function expectPressed(name: string, found: { resting: Look; pressed: Look }): void {
  expect(found.resting.transform, `${name} rests unscaled`).toBe('none')
  expect(found.pressed.transform, `${name} shrinks while pressed`).toBe('matrix(0.98, 0, 0, 0.98, 0, 0)')
  const fillChanged =
    found.pressed.boxShadow !== found.resting.boxShadow || found.pressed.fill !== found.resting.fill
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

async function openIn(page: Page, route: string, theme: (typeof THEMES)[number]): Promise<void> {
  await page.goto(route)
  await page.waitForLoadState('networkidle')
  await page.evaluate((value) => {
    if (value === 'oscuro') document.documentElement.setAttribute('data-tema', value)
  }, theme)
  await expect(page.locator(`:is(${CONTROLS}):visible`).first()).toBeVisible()
}

/**
 * Tags the visible, enabled controls of the route that are not exempt, at most
 * `PER_CLASS_SET` per distinct class set, and returns what it tagged.
 */
async function tagControls(page: Page): Promise<{ probe: string; name: string }[]> {
  return page.evaluate(
    ({ selector, exempt, perSet }) => {
      const taken = new Map<string, number>()
      const tagged: { probe: string; name: string }[] = []
      document.querySelectorAll('[data-probe]').forEach((element) => element.removeAttribute('data-probe'))
      for (const element of document.querySelectorAll(selector)) {
        const box = element.getBoundingClientRect()
        const unavailable =
          (element as HTMLButtonElement).disabled === true || element.getAttribute('aria-disabled') === 'true'
        const classes = [...element.classList]
        if (box.width === 0 || box.height === 0 || unavailable) continue
        if (element.tagName === 'INPUT' || classes.some((cls) => exempt.includes(cls))) continue
        const key = `${element.tagName} ${classes.join(' ')}`
        const count = taken.get(key) ?? 0
        if (count >= perSet) continue
        taken.set(key, count + 1)
        const probe = `p${tagged.length}`
        element.setAttribute('data-probe', probe)
        tagged.push({ probe, name: `<${element.tagName.toLowerCase()}> .${classes.join(' .') || '(no class)'}` })
      }
      return tagged
    },
    { selector: CONTROLS, exempt: EXEMPT_CLASSES, perSet: PER_CLASS_SET },
  )
}

async function expectEveryControlPressed(page: Page, route: string): Promise<void> {
  const found = await tagControls(page)
  expect(found.length, `${route} has controls to press`).toBeGreaterThan(0)
  for (const { probe, name } of found) {
    expectPressed(`${name} on ${route}`, await whilePressed(page, `[data-probe="${probe}"]`))
  }
}

const PHONE_ROUTES = [HOME, SALES, CUSTOMERS, VARIETIES, MORE, SETTINGS, SETTINGS_ACCOUNT, SETTINGS_APPEARANCE]

test.describe('on a phone', () => {
  test.use({ viewport: PHONE })

  for (const theme of THEMES) {
    test(`every control of the chrome and settings shows a press at once (${theme})`, async ({ page }) => {
      const messages: string[] = []
      watchConsole(page, messages)
      await signUpNewBusiness(page, {
        businessName: `Flores del Toque ${theme} ${Date.now()}`,
        email: `duena-toque-${theme}-${Date.now()}@example.com`,
      })

      for (const route of PHONE_ROUTES) {
        await openIn(page, route, theme)
        await expectEveryControlPressed(page, route)
      }

      await openIn(page, SETTINGS_ACCOUNT, theme)
      await page.evaluate(() => {
        const row = document.querySelector('button.boton')
        if (row === null) throw new Error('no button.boton to clone')
        const disabled = row.cloneNode(true) as HTMLButtonElement
        disabled.id = 'prueba-fila-inactiva'
        disabled.disabled = true
        row.parentElement?.append(disabled)
      })
      const inactive = await whilePressed(page, '#prueba-fila-inactiva')
      expect(inactive.pressed.transform, 'a disabled button stays unscaled').toBe('none')
      expect(inactive.pressed.boxShadow).toBe(inactive.resting.boxShadow)
      expect(inactive.pressed.fill).toBe(inactive.resting.fill)

      expect(messages).toEqual([])
    })
  }
})

test.describe('on a computer', () => {
  test.use({ viewport: COMPUTER })

  for (const theme of THEMES) {
    test(`the sidebar, with its business row, shows a press at once (${theme})`, async ({ page }) => {
      const messages: string[] = []
      watchConsole(page, messages)
      await signUpNewBusiness(page, {
        businessName: `Flores del Riel ${theme} ${Date.now()}`,
        email: `duena-riel-${theme}-${Date.now()}@example.com`,
      })

      await openIn(page, HOME, theme)
      expectPressed('the business row', await whilePressed(page, '.riel-lateral__negocio'))
      await expectEveryControlPressed(page, HOME)

      await openIn(page, SETTINGS, theme)
      expectPressed(
        'the marked business row',
        await whilePressed(page, '.riel-lateral__negocio--activo'),
      )
      await expectEveryControlPressed(page, SETTINGS)

      expect(messages).toEqual([])
    })
  }
})

test.describe('signed out', () => {
  test.use({ viewport: PHONE })

  for (const theme of THEMES) {
    test(`Entrar shows a press at once (${theme})`, async ({ page }) => {
      const messages: string[] = []
      watchConsole(page, messages)
      await openIn(page, LOGIN, theme)
      await expectEveryControlPressed(page, LOGIN)
      expect(messages).toEqual([])
    })
  }
})

test.describe('Deshacer', () => {
  test.use({ viewport: PHONE })

  for (const theme of THEMES) {
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
})
