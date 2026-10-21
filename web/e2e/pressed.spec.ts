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
  SETTINGS_PRICES,
  VARIETIES,
} from '../src/routes.js'
import { EXEMPT } from '../src/architecture/pressedExempt.js'
import { composite, contrastRatio, parseColour } from '../src/test/contrast.js'
import { expect, test } from './fixtures.js'
import type { Page } from '@playwright/test'
import { signUpNewBusiness } from './helpers/signup.js'
import { watchConsole } from './console.js'
import { fillSaleLine } from './helpers/sale.js'
import { whilePressed, type Look } from './helpers/pressed.js'
import { uniqueTag } from './helpers/unique.js'

const PHONE = { width: 390, height: 844 }
const COMPUTER = { width: 1280, height: 920 }
const PER_CLASS_SET = 3
const CONTROLS = 'button, a[href], [role=button], [role=tab], [role=radio], [role=switch]'
const EXEMPT_CLASSES = EXEMPT.flatMap((entry) => entry.classes)
const THEMES = ['claro', 'oscuro'] as const
/** The instant the page's fake clock starts at: a literal, so the spec reads no real clock. */
const PAGE_CLOCK_START = new Date('2030-01-01T12:00:00Z')

function expectFillChanged(name: string, found: { resting: Look; pressed: Look }): void {
  const fillChanged =
    found.pressed.boxShadow !== found.resting.boxShadow || found.pressed.fill !== found.resting.fill
  expect(fillChanged, `${name} changes its fill while pressed`).toBe(true)
}

function expectPressed(name: string, found: { resting: Look; pressed: Look }): void {
  expect(found.resting.transform, `${name} rests unscaled`).toBe('none')
  expect(found.pressed.transform, `${name} shrinks while pressed`).toBe('matrix(0.98, 0, 0, 0.98, 0, 0)')
  expectFillChanged(name, found)
}

/**
 * A label-wrapped control (an EXEMPT entry's `pressedOn`) answers a press with its fill alone:
 * its input is stretched over it, and a scaled label would move the input off the finger.
 */
function expectFillOnly(name: string, found: { resting: Look; pressed: Look }): void {
  expect(found.resting.transform, `${name} rests unscaled`).toBe('none')
  expect(found.pressed.transform, `${name} stays unscaled while pressed`).toBe('none')
  expectFillChanged(name, found)
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

const SWITCH = '.opcion-interruptor'

async function switchStates(page: Page): Promise<boolean[]> {
  return page.locator(`${SWITCH}:not(#prueba-interruptor-inactivo) input`).evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).checked),
  )
}

const PHONE_ROUTES = [HOME, SALES, CUSTOMERS, VARIETIES, MORE, SETTINGS, SETTINGS_ACCOUNT, SETTINGS_APPEARANCE]

test.describe('on a phone', () => {
  test.use({ viewport: PHONE })

  for (const theme of THEMES) {
    test(`every control of the chrome and settings shows a press at once (${theme})`, async ({ page }) => {
      const messages: string[] = []
      watchConsole(page, messages)
      await signUpNewBusiness(page, {
        businessName: `Flores del Toque ${theme} ${uniqueTag()}`,
        email: `duena-toque-${theme}-${uniqueTag()}@example.com`,
      })

      for (const route of PHONE_ROUTES) {
        await openIn(page, route, theme)
        await expectEveryControlPressed(page, route)
      }

      await openIn(page, SETTINGS_ACCOUNT, theme)
      await page.evaluate(() => {
        const row = document.querySelector('button.boton--suave')
        if (row === null) throw new Error('no button.boton--suave to clone')
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

test.describe('a switch on a phone', () => {
  test.use({ viewport: PHONE })

  for (const theme of THEMES) {
    test(`answers a press with its fill alone, and does not flip (${theme})`, async ({ page }) => {
      const messages: string[] = []
      watchConsole(page, messages)
      await signUpNewBusiness(page, {
        businessName: `Flores del Interruptor ${theme} ${uniqueTag()}`,
        email: `duena-interruptor-${theme}-${uniqueTag()}@example.com`,
      })
      await openIn(page, SETTINGS_PRICES, theme)

      const switches = await page.locator(`${SWITCH}:visible`).count()
      expect(switches, `${SETTINGS_PRICES} has switches to press`).toBeGreaterThan(0)
      const before = await switchStates(page)
      for (let at = 0; at < switches; at += 1) {
        const target = `${SWITCH}:visible >> nth=${at}`
        expectFillOnly(`switch ${at} on ${SETTINGS_PRICES}`, await whilePressed(page, target))
        expect(await switchStates(page), `releasing outside leaves switch ${at} as it was`).toEqual(before)
      }

      await page.evaluate((selector) => {
        const row = document.querySelector(selector)
        if (row === null) throw new Error('no switch to clone')
        const disabled = row.cloneNode(true) as HTMLElement
        disabled.id = 'prueba-interruptor-inactivo'
        disabled.removeAttribute('for')
        disabled.classList.add('opcion-interruptor--inactiva')
        const input = disabled.querySelector('input')
        if (input === null) throw new Error('the switch has no input')
        input.removeAttribute('id')
        input.disabled = true
        row.parentElement?.append(disabled)
      }, SWITCH)
      const inactive = await whilePressed(page, '#prueba-interruptor-inactivo')
      expect(inactive.pressed.transform, 'a disabled switch stays unscaled').toBe('none')
      expect(inactive.pressed.boxShadow).toBe(inactive.resting.boxShadow)
      expect(inactive.pressed.fill).toBe(inactive.resting.fill)
      expect(await switchStates(page)).toEqual(before)

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
        businessName: `Flores del Riel ${theme} ${uniqueTag()}`,
        email: `duena-riel-${theme}-${uniqueTag()}@example.com`,
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

/** What the eye gets from a control: its fill and its ink, both shown at its `opacity`. */
interface Ink {
  backgroundColor: string
  color: string
  opacity: string
}

async function ink(page: Page, selector: string): Promise<Ink> {
  return page.locator(selector).first().evaluate((element) => {
    const { backgroundColor, color, opacity } = getComputedStyle(element)
    return { backgroundColor, color, opacity }
  })
}

/** The ratio the eye gets from a control that rests on `backdrop` (an opaque background). */
function effectiveRatio(look: Ink, backdrop: string): number {
  const opacity = Number(look.opacity)
  const fill = composite(parseColour(look.backgroundColor), opacity, parseColour(backdrop))
  const text = composite(parseColour(look.color), opacity, fill)
  return contrastRatio(text, fill)
}

test.describe('Undo', () => {
  test.use({ viewport: PHONE })

  for (const theme of THEMES) {
    test(`keeps 4.5:1 at rest and while pressed (${theme})`, async ({ page }) => {
      await signUpNewBusiness(page, {
        businessName: `Flores del Deshacer ${theme} ${uniqueTag()}`,
        email: `duena-deshacer-${theme}-${uniqueTag()}@example.com`,
      })
      await page.goto(VARIETIES)
      await page.getByRole('link', { name: 'New variety' }).click()
      await page.getByLabel('Name').fill('Rosa')
      await page.getByRole('button', { name: 'Agregá la variedad' }).click()
      await expect(page.getByText('Variedad guardada')).toBeVisible()
      await page.getByRole('link', { name: /Rosa/ }).click()
      await page.getByRole('link', { name: 'New price' }).click()
      await page.getByLabel(/^Precio de lista/).fill('1000')
      await page.getByRole('button', { name: 'Guardá el precio' }).click()
      await expect(page.getByText('Precio guardado')).toBeVisible()

      await page.goto(SALE_NEW)
      await page.evaluate((value) => {
        if (value === 'oscuro') document.documentElement.setAttribute('data-tema', value)
      }, theme)
      // The notice lasts 5 s (`UNDO_WINDOW_MS`): time runs for the save, then stops once the
      // notice is up, so it cannot go while the button is read.
      await page.clock.install({ time: PAGE_CLOCK_START })
      await fillSaleLine(page, 1, { variety: 'Rosa', grams: '2' })
      await page.getByRole('radio', { name: 'Cash' }).check()
      await page.getByRole('button', { name: 'Save sale' }).click()
      await expect(page.getByText('Sale saved')).toBeVisible()
      // `performance.now()` counts the fake milliseconds since the install, so the page's
      // clock is read from the start instant the spec chose, never from the real one.
      const sinceInstall = await page.evaluate(() => performance.now())
      await page.clock.pauseAt(new Date(PAGE_CLOCK_START.getTime() + sinceInstall + 50))

      const deshacer = '.venta-guardada .boton--enlace'
      const backdrop = await page.locator('.venta-guardada').evaluate((bar) => getComputedStyle(bar).backgroundColor)
      const found = await whilePressed(page, deshacer)
      expectPressed('Undo', found)

      const resting = await ink(page, deshacer)
      expect(effectiveRatio(resting, backdrop), 'Deshacer at rest').toBeGreaterThanOrEqual(4.5)
      const box = await page.locator(deshacer).boundingBox()
      if (box === null) throw new Error('Deshacer has no box')
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      const pressed = await ink(page, deshacer)
      await page.mouse.move(0, 0)
      await page.mouse.up()
      expect(effectiveRatio(pressed, backdrop), 'Deshacer while pressed').toBeGreaterThanOrEqual(4.5)

      await expect(page.getByText('Sale saved')).toBeVisible()
      await expect(page.getByText('Sale deleted · the grams go back to stock')).toHaveCount(0)
    })
  }
})
