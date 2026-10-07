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
  SALES,
  SETTINGS,
  SETTINGS_ACCOUNT,
  SETTINGS_APPEARANCE,
  VARIETIES,
} from '../src/routes.js'
import { EXEMPT } from '../src/architecture/pressedExempt.js'
import { expect, test, type Page } from '@playwright/test'
import { signUpNewBusiness } from './helpers/signup.js'
import { watchConsole } from './console.js'

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
}

async function look(page: Page, selector: string): Promise<Look> {
  return page.locator(selector).first().evaluate((element) => {
    const { transform, boxShadow } = getComputedStyle(element)
    let fill = 'rgba(0, 0, 0, 0)'
    for (let node: Element | null = element; node !== null; node = node.parentElement) {
      const own = getComputedStyle(node).backgroundColor
      if (own !== 'rgba(0, 0, 0, 0)' && own !== 'transparent') {
        fill = own
        break
      }
    }
    return { transform, boxShadow, fill }
  })
}

/** The look of `selector` with the pointer down on it (moved away before release, so no click fires). */
async function whilePressed(page: Page, selector: string): Promise<{ resting: Look; pressed: Look }> {
  const target = page.locator(selector).first()
  await expect(target).toBeVisible()
  await target.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'center' }))
  const resting = await look(page, selector)
  const box = await target.boundingBox()
  if (box === null) throw new Error(`${selector} has no box`)
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  const covered = await target.evaluate(
    (element, point) => !element.contains(document.elementFromPoint(point.x, point.y)),
    { x, y },
  )
  if (covered) throw new Error(`${selector} is covered at its centre, so a press would land on something else`)
  await page.mouse.move(x, y)
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
    found.pressed.boxShadow !== found.resting.boxShadow || found.pressed.fill !== found.resting.fill
  expect(fillChanged, `${name} changes its fill while pressed`).toBe(true)
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
        const row = document.querySelector('.ajustes__item--boton')
        if (row === null) throw new Error('no .ajustes__item--boton to clone')
        const disabled = row.cloneNode(true) as HTMLButtonElement
        disabled.id = 'prueba-fila-inactiva'
        disabled.disabled = true
        row.parentElement?.append(disabled)
      })
      const inactive = await whilePressed(page, '#prueba-fila-inactiva')
      expect(inactive.pressed.transform, 'a disabled row stays unscaled').toBe('none')
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
