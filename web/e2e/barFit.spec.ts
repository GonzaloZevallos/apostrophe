/**
 * The bar fits at 320 px with text at 130 % (PRD criterion 4, Behaviour 9), measured in a real
 * browser: jsdom lays nothing out, so the jsdom test that stood in for it measured nothing.
 *
 * Browser text zoom is not something a Playwright page can switch on, and the bar's and the
 * rail's labels are sized in px/rem of their own, so the spec does what the zoom does: it
 * measures every label's computed `font-size`, injects a stylesheet that sets it to 1.3 times
 * that baseline, asserts the scale took before it measures anything, and then asks the layout
 * (`getBoundingClientRect`, `scrollWidth <= clientWidth`) whether each label is whole.
 *
 * The bottom bar exists below 900 px and the side rail from 900 px up (`app.css`), so the bar is
 * measured on the phone at 320 px and the rail on the computer, where its own 212 px column is
 * the same at every width.
 */

import { expect, test, type Page } from '@playwright/test'
import { watchConsole } from './console.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { HOME } from '../src/routes.js'

const PHONE = { width: 320, height: 700 }
const COMPUTER = { width: 1280, height: 920 }
const SCALE = 1.3
/** Sub-pixel layout rounds; a label is clipped by pixels, not by a fraction of one. */
const TOLERANCE = 0.5

const BAR_LABELS = ['Inicio', 'Ventas', 'Clientes', 'Variedades', 'Más']
const RAIL_LABELS = ['Inicio', 'Ventas', 'Clientes', 'Variedades', 'Gastos', 'Análisis']

interface Scaled {
  tag: string
  baseline: number
  scaled: number
}

/**
 * Tags every text-bearing element of `surface` (the surface's own links and the spans inside
 * them, the avatar included), injects a stylesheet that sets each one's `font-size` to
 * `scale` times its measured baseline, and returns what it did.
 */
async function scaleText(page: Page, surface: string, scale: number): Promise<Scaled[]> {
  return page.evaluate(
    ({ surface: selector, scale: factor }) => {
      const root = document.querySelector(selector)
      if (root === null) throw new Error(`no ${selector}`)
      // A scale from an earlier call is undone first, so the baseline is the real one.
      document.querySelectorAll('style[data-fit-style]').forEach((style) => style.remove())
      document.querySelectorAll('[data-fit]').forEach((element) => element.removeAttribute('data-fit'))
      const targets = [...root.querySelectorAll('a, a span')]
      const rules: string[] = []
      const done: { tag: string; baseline: number; scaled: number }[] = []
      targets.forEach((element, index) => {
        const baseline = parseFloat(getComputedStyle(element).fontSize)
        const scaled = baseline * factor
        const tag = `fit-${index}`
        element.setAttribute('data-fit', tag)
        rules.push(`[data-fit="${tag}"] { font-size: ${scaled}px !important; }`)
        done.push({ tag, baseline, scaled })
      })
      const style = document.createElement('style')
      style.setAttribute('data-fit-style', '')
      style.textContent = rules.join('\n')
      document.head.appendChild(style)
      return done
    },
    { surface, scale },
  )
}

interface Item {
  text: string
  current: string | null
  /** Where the item's text is drawn, from a Range over its text nodes. */
  textLeft: number
  textRight: number
  left: number
  right: number
  clipped: boolean
}

async function measureItems(page: Page, surface: string, itemSelector: string): Promise<Item[]> {
  return page.evaluate(
    ({ surface: selector, itemSelector: items }) => {
      const root = document.querySelector(selector)
      if (root === null) throw new Error(`no ${selector}`)
      return [...root.querySelectorAll<HTMLElement>(items)].map((item) => {
        const text = [...item.querySelectorAll('span')].reduce<HTMLElement | null>(
          (found, span) => found ?? (span.textContent === item.textContent ? span : null),
          null,
        )
        const label = text ?? item
        const labelRange = document.createRange()
        labelRange.selectNodeContents(label)
        const drawn = labelRange.getBoundingClientRect()
        const box = item.getBoundingClientRect()
        return {
          text: (item.textContent ?? '').trim(),
          current: item.getAttribute('aria-current'),
          textLeft: drawn.left,
          textRight: drawn.right,
          left: box.left,
          right: box.right,
          clipped:
            item.scrollWidth > item.clientWidth || label.scrollWidth > label.clientWidth,
        }
      })
    },
    { surface, itemSelector },
  )
}

async function expectScaled(page: Page, scaled: Scaled[], scale: number): Promise<void> {
  expect(scaled.length).toBeGreaterThan(0)
  for (const entry of scaled) {
    const actual = await page.evaluate(
      (tag) => {
        const element = document.querySelector(`[data-fit="${tag}"]`)
        if (element === null) throw new Error(`no ${tag}`)
        return parseFloat(getComputedStyle(element).fontSize)
      },
      entry.tag,
    )
    expect(Math.abs(actual - entry.baseline * scale), `font-size of ${entry.tag}`).toBeLessThanOrEqual(TOLERANCE)
  }
}

/** What is wrong with the items' fit, one line each; empty when every label is whole. */
function violations(items: Item[], labels: string[], within: { left: number; right: number }): string[] {
  const found: string[] = []
  if (items.map((item) => item.text).join('|') !== labels.join('|')) found.push('the labels differ')
  for (const item of items) {
    if (item.clipped) found.push(`${item.text} is clipped`)
    if (item.textLeft < item.left - TOLERANCE || item.textRight > item.right + TOLERANCE) {
      found.push(`${item.text} is drawn outside its item`)
    }
    if (item.left < within.left - TOLERANCE || item.right > within.right + TOLERANCE) {
      found.push(`${item.text} is outside the surface`)
    }
  }
  return found
}

/** Neighbours side by side never overlap. */
function overlaps(items: Item[]): string[] {
  return items.flatMap((item, index) => {
    const before = items[index - 1]
    return before !== undefined && before.right > item.left + TOLERANCE ? [`${item.text} overlaps ${before.text}`] : []
  })
}

async function surfaceBox(page: Page, surface: string): Promise<{ left: number; right: number; overflows: boolean }> {
  return page.locator(surface).evaluate((element) => {
    const box = element.getBoundingClientRect()
    return { left: box.left, right: box.right, overflows: element.scrollWidth > element.clientWidth }
  })
}

/** Scales the bottom bar's text by `scale` on Inicio at 320 px, and returns every way it does not fit. */
async function bottomBarProblems(page: Page, scale: number): Promise<{ problems: string[]; items: Item[] }> {
  await page.setViewportSize(PHONE)
  await page.goto(HOME)
  await expect(page.locator('.bar-inferior')).toBeVisible()

  const scaled = await scaleText(page, '.bar-inferior', scale)
  await expectScaled(page, scaled, scale)

  const items = await measureItems(page, '.bar-inferior', '.bar-inferior__item')
  const bar = await surfaceBox(page, '.bar-inferior')
  const pageOverflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  const problems = [
    ...violations(items, BAR_LABELS, bar),
    ...overlaps(items),
    ...(bar.overflows ? ['the bar scrolls sideways'] : []),
    ...(pageOverflows ? ['the page scrolls sideways'] : []),
  ]
  return { problems, items }
}

// One business for the three tests: signing up is the slow step, and each test only reads layout.
test.describe.serial('bar and rail fit', () => {
  let page: Page
  const consoleMessages: string[] = []

  test.beforeAll(async ({ browser }) => {
    page = await (await browser.newContext({ viewport: PHONE })).newPage()
    watchConsole(page, consoleMessages)
    await signUpNewBusiness(page)
  })

  test.afterAll(async () => {
    await page.context().close()
  })

  test('at 320 px with text at 130 %, every bottom-bar label is whole and the active tab says so', async () => {
    const { problems, items } = await bottomBarProblems(page, SCALE)

    expect(problems).toEqual([])
    expect(items.filter((item) => item.current === 'page').map((item) => item.text)).toEqual(['Inicio'])
  })

  test('the measurement rejects a bar that does not fit: at three times the text the labels overflow', async () => {
    const { problems } = await bottomBarProblems(page, 3)

    expect(problems.length).toBeGreaterThan(0)
  })

  test('with text at 130 %, every side-rail label is whole and the active tab says so', async () => {
    await page.setViewportSize(COMPUTER)
    await page.goto(HOME)
    await expect(page.locator('.riel-lateral')).toBeVisible()

    const scaled = await scaleText(page, '.riel-lateral', SCALE)
    await expectScaled(page, scaled, SCALE)

    const rail = await surfaceBox(page, '.riel-lateral')
    const items = (await measureItems(page, '.riel-lateral', '.riel-lateral__item')).filter((item) =>
      RAIL_LABELS.includes(item.text),
    )
    const business = await measureItems(page, '.riel-lateral', '.riel-lateral__negocio')

    expect([
      ...violations(items, RAIL_LABELS, rail),
      ...violations(business, [business[0]?.text ?? ''], rail),
      ...(rail.overflows ? ['the rail scrolls sideways'] : []),
    ]).toEqual([])
    expect(business).toHaveLength(1)
    expect(items.filter((item) => item.current === 'page').map((item) => item.text)).toEqual(['Inicio'])
    expect(consoleMessages).toEqual([])
  })
})
