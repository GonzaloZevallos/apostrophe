/**
 * The bar fits at 320 px with text at 130 % (PRD criterion 4, Behaviour 9), measured in a real
 * browser: jsdom lays nothing out, so the jsdom test that stood in for it measured nothing.
 *
 * Browser text zoom is not something a Playwright page can switch on, so the spec scales the
 * text with `helpers/textScale.ts` (every element of the bar or rail and `<html>`, as its header
 * says), asserts the scale took before it measures anything, and then asks the layout
 * (`getBoundingClientRect`, `scrollWidth <= clientWidth`) whether each label is whole. The bar
 * and the rail never re-render between the scaling and the measurement, which is the one case
 * the helper allows its two steps to be called apart.
 *
 * The bottom bar exists below 900 px and the side rail from 900 px up (`app.css`), so the bar is
 * measured on the phone at 320 px and the rail on the computer, where its own 212 px column is
 * the same at every width.
 */

import { expect, test, withToastRecorder } from './fixtures.js'
import type { Page } from '@playwright/test'
import { watchConsole } from './console.js'
import {
  PHONE_CONTEXT,
  TEXT_SCALE,
  TOLERANCE,
  applyTextScale,
  expectCoarsePointer,
  expectTextScaled,
} from './helpers/textScale.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { HOME } from '../src/routes.js'

const PHONE = { width: 320, height: 700 }
const COMPUTER = { width: 1280, height: 920 }

test.use(PHONE_CONTEXT)

const BAR_LABELS = ['Home', 'Sales', 'Customers', 'Varieties', 'More']
const RAIL_LABELS = ['Home', 'Sales', 'Customers', 'Varieties', 'Expenses', 'Analysis']

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

/** Every icon of the surface is drawn whole, 22 px wide, inside the item that holds it. */
async function iconProblems(
  page: Page,
  surface: string,
  itemSelector: string,
  required: boolean,
): Promise<string[]> {
  return page.evaluate(
    ({ surface: selector, itemSelector: items, tolerance, mustHave }) => {
      const root = document.querySelector(selector)
      if (root === null) throw new Error(`no ${selector}`)
      const found: string[] = []
      for (const item of root.querySelectorAll<HTMLElement>(items)) {
        const icon = item.querySelector('svg')
        const name = (item.textContent ?? '').trim()
        if (icon === null) {
          if (mustHave) found.push(`${name} has no icon`)
          continue
        }
        const box = icon.getBoundingClientRect()
        const around = item.getBoundingClientRect()
        if (Math.abs(box.width - 22) > tolerance) found.push(`${name}'s icon is ${box.width} px wide`)
        if (box.left < around.left - tolerance || box.right > around.right + tolerance) {
          found.push(`${name}'s icon is clipped sideways`)
        }
        if (box.top < around.top - tolerance || box.bottom > around.bottom + tolerance) {
          found.push(`${name}'s icon is clipped vertically`)
        }
      }
      return found
    },
    { surface, itemSelector, tolerance: TOLERANCE, mustHave: required },
  )
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

  await expectCoarsePointer(page, 'the bottom bar')
  const scaled = await applyTextScale(page, '.bar-inferior', scale)
  await expectTextScaled(page, scaled, scale)

  const items = await measureItems(page, '.bar-inferior', '.bar-inferior__item')
  const bar = await surfaceBox(page, '.bar-inferior')
  const pageOverflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  const problems = [
    ...violations(items, BAR_LABELS, bar),
    ...overlaps(items),
    ...(await iconProblems(page, '.bar-inferior', '.bar-inferior__item', true)),
    ...(bar.overflows ? ['the bar scrolls sideways'] : []),
    ...(pageOverflows ? ['the page scrolls sideways'] : []),
  ]
  return { problems, items }
}

// One business for the three tests: signing up is the slow step, and each test only reads layout.
test.describe.serial('bar and rail fit', () => {
  let page: Page
  const consoleMessages: string[] = []

  test.beforeAll(async ({ browser, workerServer }) => {
    page = await (await withToastRecorder(browser.newContext({ ...PHONE_CONTEXT, baseURL: workerServer.url, viewport: PHONE }))).newPage()
    watchConsole(page, consoleMessages)
    await signUpNewBusiness(page)
  })

  test.afterAll(async () => {
    await page.context().close()
  })

  test('at 320 px with text at 130 %, every bottom-bar label is whole and the active tab says so', async () => {
    const { problems, items } = await bottomBarProblems(page, TEXT_SCALE)

    expect(problems).toEqual([])
    expect(items.filter((item) => item.current === 'page').map((item) => item.text)).toEqual(['Home'])
  })

  test('the measurement rejects a bar that does not fit: at three times the text the labels overflow', async () => {
    const { problems } = await bottomBarProblems(page, 3)

    expect(problems.length).toBeGreaterThan(0)
  })

  test('with text at 130 %, every side-rail label is whole and the active tab says so', async () => {
    await page.setViewportSize(COMPUTER)
    await page.goto(HOME)
    await expect(page.locator('.riel-lateral')).toBeVisible()

    await expectCoarsePointer(page, 'the side rail')
    const scaled = await applyTextScale(page, '.riel-lateral', TEXT_SCALE)
    await expectTextScaled(page, scaled, TEXT_SCALE)

    const rail = await surfaceBox(page, '.riel-lateral')
    const items = (await measureItems(page, '.riel-lateral', '.riel-lateral__item')).filter((item) =>
      RAIL_LABELS.includes(item.text),
    )
    const business = await measureItems(page, '.riel-lateral', '.riel-lateral__negocio')

    expect([
      ...violations(items, RAIL_LABELS, rail),
      ...violations(business, [business[0]?.text ?? ''], rail),
      // The rail's Gastos and Análisis have no design icon yet (GH-97 open finding), so a rail
      // item without one is not failed here; one that has an icon must show it whole.
      ...(await iconProblems(page, '.riel-lateral', '.riel-lateral__item', false)),
      ...(rail.overflows ? ['the rail scrolls sideways'] : []),
    ]).toEqual([])
    expect(business).toHaveLength(1)
    expect(items.filter((item) => item.current === 'page').map((item) => item.text)).toEqual(['Home'])
    expect(consoleMessages).toEqual([])
  })

  test('the scaling check rejects a label that did not take the scale, and one that is gone', async () => {
    await page.setViewportSize(PHONE)
    await page.goto(HOME)
    await expect(page.locator('.bar-inferior')).toBeVisible()

    const stale = await applyTextScale(page, '.bar-inferior', TEXT_SCALE)
    await page.locator('.bar-inferior a').first().evaluate((link) => link.setAttribute('style', 'font-size: 10px !important'))
    await expect(expectTextScaled(page, stale, TEXT_SCALE)).rejects.toThrow(/font-size of the scaled elements/)

    const lost = await applyTextScale(page, '.bar-inferior', TEXT_SCALE)
    await page.locator('.bar-inferior a').first().evaluate((link) => link.removeAttribute('data-fit'))
    await expect(expectTextScaled(page, lost, TEXT_SCALE)).rejects.toThrow(/gone/)
    await expect(expectTextScaled(page, [], TEXT_SCALE)).rejects.toThrow()
  })
})

test('the pointer check rejects a page whose pointer is not coarse', async ({ browser, workerServer }) => {
  // `test.use` is the default of every context, so the desktop one says so itself.
  const context = await withToastRecorder(browser.newContext({
    baseURL: workerServer.url,
    isMobile: false,
    hasTouch: false,
    viewport: PHONE,
  }))
  const desktop = await context.newPage()
  await desktop.goto('about:blank')
  await expect(expectCoarsePointer(desktop, 'a desktop')).rejects.toThrow(/coarse pointer/)
  await context.close()
})
