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
import type { Locator, Page } from '@playwright/test'
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
import { seedLedger } from './helpers/ledger.js'
import { uniqueTag } from './helpers/unique.js'
import { expectToast } from './helpers/toast.js'
import { choosePaymentMethod } from './helpers/paymentMethod.js'
import { CUSTOMERS_TEXT } from '../src/copy/customers.js'
import { CUSTOMERS, HOME } from '../src/routes.js'
import { BOTTOM_BAR, BOTTOM_BAR_ITEM, BOTTOM_BAR_PLUS, bottomBar } from './helpers/chrome.js'

const PHONE = { width: 320, height: 700 }
/** The narrowest phone the bar must fit (Step 1 of GH-727: measure before anything is built on it). */
const NARROW = { width: 246, height: 700 }
const TAB_BOX = 44
const PLUS_BOX = 52
const LABEL_WEIGHT = 600
const COMPUTER = { width: 1280, height: 920 }

test.use(PHONE_CONTEXT)

const BAR_LABELS = ['Home', 'Sales', 'Customers', 'Products']
const RAIL_LABELS = ['Home', 'Sales', 'Customers', 'Products', 'Expenses', 'Analysis']

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
  await expect(bottomBar(page)).toBeVisible()

  await expectCoarsePointer(page, 'the bottom bar')
  const scaled = await applyTextScale(page, BOTTOM_BAR, scale)
  await expectTextScaled(page, scaled, scale)

  const items = await measureItems(page, BOTTOM_BAR, BOTTOM_BAR_ITEM)
  const bar = await surfaceBox(page, BOTTOM_BAR)
  const pageOverflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  const problems = [
    ...violations(items, BAR_LABELS, bar),
    ...overlaps(items),
    ...(await iconProblems(page, BOTTOM_BAR, BOTTOM_BAR_ITEM, true)),
    ...(bar.overflows ? ['the bar scrolls sideways'] : []),
    ...(pageOverflows ? ['the page scrolls sideways'] : []),
  ]
  return { problems, items }
}

interface Slot {
  kind: 'tab' | 'plus'
  label: string
  width: number
  height: number
  /** The label's drawn width at weight 600 (a Range over its text, with the weight forced); 0 for the +. */
  labelWidth: number
  /** Whether the label is drawn (not the visually hidden text of the icons-only bar); false for the +. */
  shown: boolean
}

/** Every slot of the bar in order, as it lays out now: the tabs' and the +'s boxes and each label's width at weight 600. */
async function measureSlots(page: Page): Promise<Slot[]> {
  return page.locator(BOTTOM_BAR).evaluate(
    (bar, args) => {
      // Only the slots: the + 's hidden description is a child of the bar too, but it is never a slot.
      return [...bar.children].filter((child) => child.matches(`${args.item}, ${args.plus}`)).map((slot): Slot => {
        const box = slot.getBoundingClientRect()
        const label = slot.querySelector('span')
        if (!slot.matches(args.item) || label === null) {
          return { kind: 'plus', label: '+', width: box.width, height: box.height, labelWidth: 0, shown: false }
        }
        const before = label.style.fontWeight
        label.style.fontWeight = String(args.weight)
        const range = document.createRange()
        range.selectNodeContents(label.firstChild ?? label)
        const labelWidth = range.getBoundingClientRect().width
        label.style.fontWeight = before
        const shown = label.getBoundingClientRect().width > 1
        return { kind: 'tab', label: label.textContent ?? '', width: box.width, height: box.height, labelWidth, shown }
      })
    },
    { item: BOTTOM_BAR_ITEM, plus: BOTTOM_BAR_PLUS, weight: LABEL_WEIGHT },
  )
}

/**
 * Why the slots do not fit, one line each; empty when the bar is right for this width. Every tab box is
 * at least 44 px each way at every width. Where 44 px for every tab, each label whole at weight 600 and
 * the 52 px + are wider than the viewport, the bar is icons only (Human Decision 3, GH-789): no label is
 * drawn but each stays in the DOM as the tab's name. Anywhere else every label is drawn whole in its box.
 */
function slotProblems(slots: Slot[], viewport: number): string[] {
  const found: string[] = []
  const tabs = slots.filter((slot) => slot.kind === 'tab')
  const wanted = slots.reduce((sum, slot) => sum + (slot.kind === 'plus' ? PLUS_BOX : Math.max(TAB_BOX, slot.labelWidth)), 0)
  const iconsOnly = wanted > viewport + TOLERANCE
  if (slots.map((slot) => slot.label).join('|') !== ['Home', 'Sales', '+', 'Customers', 'Products'].join('|')) {
    found.push('the slots are not Home, Sales, +, Customers, Products')
  }
  for (const slot of slots) {
    const [minWidth, minHeight] = slot.kind === 'plus' ? [PLUS_BOX, PLUS_BOX] : [TAB_BOX, TAB_BOX]
    if (slot.width < minWidth - TOLERANCE) found.push(`${slot.label} is ${slot.width} px wide, under ${minWidth}`)
    if (slot.height < minHeight - TOLERANCE) found.push(`${slot.label} is ${slot.height} px tall, under ${minHeight}`)
    if (slot.kind === 'tab' && slot.label.trim() === '') found.push('a tab has no name')
    if (slot.kind === 'tab' && !iconsOnly && !slot.shown) found.push(`${slot.label} has no visible label where every label fits`)
    if (slot.kind === 'tab' && iconsOnly && slot.shown) found.push(`${slot.label} draws its label where 44 px for every tab does not fit`)
    if (slot.kind === 'tab' && slot.shown && slot.labelWidth > slot.width + TOLERANCE) {
      found.push(`${slot.label} is ${slot.labelWidth} px of text in a ${slot.width} px slot`)
    }
  }
  if (tabs.length === 0) found.push('the bar has no tabs')
  if (slots.reduce((sum, slot) => sum + slot.width, 0) > viewport + TOLERANCE) found.push('the slots are wider than the viewport')
  return found
}

function slotTable(slots: Slot[], viewport: number, theme: string): string {
  const rows = slots.map(
    (slot) =>
      `| ${slot.label} | ${slot.width.toFixed(2)} | ${slot.kind === 'tab' ? slot.labelWidth.toFixed(2) : '-'} | ${
        slot.kind === 'tab' ? (slot.width - slot.labelWidth).toFixed(2) : '-'
      } | ${viewport} | ${theme} | ${slot.kind === 'tab' ? (slot.shown ? 'label' : 'icon only') : '-'} |`,
  )
  return ['| label | slot width | label width at 600 | slack | viewport | theme | mode |', '|---|---|---|---|---|---|---|', ...rows].join('\n')
}

const tabSlot = (label: string, width: number, labelWidth: number, shown = true): Slot => ({
  kind: 'tab',
  label,
  width,
  height: 44,
  labelWidth,
  shown,
})
const PLUS_SLOT: Slot = { kind: 'plus', label: '+', width: 52, height: 52, labelWidth: 0, shown: false }

test('the slot check rejects a bar whose label is wider than its slot', () => {
  const slots: Slot[] = [tabSlot('Home', 40, 30), tabSlot('Customers', 46, 58)]

  expect(slotProblems(slots, 246)).toEqual([
    'the slots are not Home, Sales, +, Customers, Products',
    'Home is 40 px wide, under 44',
    'Customers is 58 px of text in a 46 px slot',
  ])
})

test('the slot check wants icons only where 44 px for every tab and every label does not fit, and labels elsewhere', () => {
  const bar = (home: number, shown: boolean): Slot[] => [
    tabSlot('Home', home, 34, shown),
    tabSlot('Sales', home, 33, shown),
    PLUS_SLOT,
    tabSlot('Customers', 48.5, 65, shown),
    tabSlot('Products', 48.5, 53, shown),
  ]

  // 246 px: 44 + 44 + 52 + 65 + 53 = 258 does not fit, so icons only, every tab 44 px or more.
  expect(slotProblems(bar(48.5, false), 246)).toEqual([])
  expect(slotProblems(bar(48.5, true), 246)).toEqual([
    'Home draws its label where 44 px for every tab does not fit',
    'Sales draws its label where 44 px for every tab does not fit',
    'Customers draws its label where 44 px for every tab does not fit',
    'Customers is 65 px of text in a 48.5 px slot',
    'Products draws its label where 44 px for every tab does not fit',
    'Products is 53 px of text in a 48.5 px slot',
  ])
  expect(slotProblems(bar(38, false), 246)).toEqual(['Home is 38 px wide, under 44', 'Sales is 38 px wide, under 44'])
  // 320 px: every label fits, so every label is drawn and icons only is wrong.
  const wide: Slot[] = [
    tabSlot('Home', 60, 34),
    tabSlot('Sales', 60, 33),
    PLUS_SLOT,
    tabSlot('Customers', 70, 65),
    tabSlot('Products', 60, 53),
  ]
  expect(slotProblems(wide, 320)).toEqual([])
  expect(slotProblems(bar(44, true), 320)).toEqual([
    'Customers is 65 px of text in a 48.5 px slot',
    'Products is 53 px of text in a 48.5 px slot',
  ])
  expect(slotProblems(bar(44, false), 320)).toEqual([
    'Home has no visible label where every label fits',
    'Sales has no visible label where every label fits',
    'Customers has no visible label where every label fits',
    'Products has no visible label where every label fits',
  ])
})

/**
 * Why the tabs are not equal widths, one line each; empty when the bar is right for this width. The even
 * share of a bar is `(viewport - 52) / 4`. Where that share holds every tab's own need (44 px or its label
 * at weight 600, the wider) every tab is the same width; where it does not, only a tab whose label needs
 * more than the share may be wider, and the tabs that fit the share are equal to each other.
 */
function equalWidthProblems(slots: Slot[], viewport: number): string[] {
  const tabs = slots.filter((slot) => slot.kind === 'tab')
  const share = (viewport - PLUS_BOX) / 4
  const needing = tabs.filter((tab) => Math.max(TAB_BOX, tab.labelWidth) > share + TOLERANCE)
  const even = tabs.filter((tab) => !needing.includes(tab))
  if (even.length === 0) return []
  const narrowest = Math.min(...even.map((tab) => tab.width))
  const widest = Math.max(...even.map((tab) => tab.width))
  if (widest - narrowest <= TOLERANCE) return []
  return [
    `the tabs are not equal: ${even.map((tab) => `${tab.label} ${tab.width.toFixed(2)}`).join(', ')} (share ${share.toFixed(2)}, wider only for ${
      needing.map((tab) => tab.label).join(', ') || 'none'
    })`,
  ]
}

interface Box {
  left: number
  right: number
  top: number
  bottom: number
}

/** Two boxes share area; boxes that only touch along an edge do not (zero tolerance). */
function intersects(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

const boxOf = (left: number, top: number, right: number, bottom: number): Box => ({ left, top, right, bottom })

test('the equal-width check accepts an even bar and one where only a long label is wider, and rejects an unequal one', () => {
  const bar = (widths: [number, number, number, number], labels: [number, number, number, number] = [34, 33, 65, 53]): Slot[] => [
    tabSlot('Home', widths[0], labels[0]),
    tabSlot('Sales', widths[1], labels[1]),
    PLUS_SLOT,
    tabSlot('Customers', widths[2], labels[2]),
    tabSlot('Products', widths[3], labels[3]),
  ]

  // 320 px: the share is 67 and holds every label, so every tab is 67.
  expect(equalWidthProblems(bar([67, 67, 67, 67]), 320)).toEqual([])
  expect(equalWidthProblems(bar([67, 67.3, 66.9, 67]), 320)).toEqual([])
  // 246 px: the share is 48.5 and Customers (65) needs more, so only it may be wider.
  expect(equalWidthProblems(bar([45.5, 45.5, 65, 45.5]), 246)).toEqual([])
  expect(equalWidthProblems(bar([48.5, 48.5, 48.5, 48.5]), 246)).toEqual([])

  expect(equalWidthProblems(bar([60, 67, 67, 67]), 320)).toEqual([
    'the tabs are not equal: Home 60.00, Sales 67.00, Customers 67.00, Products 67.00 (share 67.00, wider only for none)',
  ])
  // Customers is wider than the share needs and so is the only exception; Products wider than Home is not one.
  expect(equalWidthProblems(bar([45, 45, 65, 52], [34, 33, 65, 40]), 246)).toEqual([
    'the tabs are not equal: Home 45.00, Sales 45.00, Products 52.00 (share 48.50, wider only for Customers)',
  ])
  // A wide tab at 320 where every label fits the share is not an exception either.
  expect(equalWidthProblems(bar([60, 60, 80, 60]), 320)).toHaveLength(1)
})

test('the overlap check rejects boxes that share area and accepts boxes that only touch', () => {
  expect(intersects(boxOf(0, 0, 10, 10), boxOf(5, 5, 15, 15))).toBe(true)
  expect(intersects(boxOf(0, 0, 10, 10), boxOf(0, 10, 10, 20))).toBe(false)
  expect(intersects(boxOf(0, 0, 10, 10), boxOf(11, 0, 20, 10))).toBe(false)
})

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

  for (const theme of ['light', 'dark'] as const) {
    test(`at 246 px in ${theme}, the bar is icons only, every tab named and no box under its minimum`, async () => {
      await page.emulateMedia({ colorScheme: theme })
      await page.setViewportSize(NARROW)
      await page.goto(HOME)
      await expect(bottomBar(page)).toBeVisible()
      await expect(page.locator(BOTTOM_BAR_PLUS)).toHaveCount(1)
      // Automatic follows the emulated scheme: the attribute says `oscuro` in dark and is not that in light.
      const dark = await page.evaluate(() => document.documentElement.getAttribute('data-tema') === 'oscuro')
      expect(dark).toBe(theme === 'dark')

      const slots = await measureSlots(page)
      const table = slotTable(slots, NARROW.width, theme)
      console.log(table)
      await test.info().attach(`slots-246-${theme}`, { body: table, contentType: 'text/markdown' })

      const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      expect([...slotProblems(slots, NARROW.width), ...(overflows ? ['the page scrolls sideways'] : [])]).toEqual([])
    })
  }

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
    await expect(bottomBar(page)).toBeVisible()

    const stale = await applyTextScale(page, BOTTOM_BAR, TEXT_SCALE)
    await bottomBar(page).locator('a').first().evaluate((link) => link.setAttribute('style', 'font-size: 10px !important'))
    await expect(expectTextScaled(page, stale, TEXT_SCALE)).rejects.toThrow(/font-size of the scaled elements/)

    const lost = await applyTextScale(page, BOTTOM_BAR, TEXT_SCALE)
    await bottomBar(page).locator('a').first().evaluate((link) => link.removeAttribute('data-fit'))
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

const WIDTHS = [246, 320, 375, 430]
/** A 60-character name: long enough to make the card's pinned action wrap on a phone. */
const LONG_NAME = `${uniqueTag()} Fernandez Gonzalez Perez Ramirez Lopez Diaz Torres Vega`.slice(0, 60)

async function rectOf(locator: Locator): Promise<Box> {
  return locator.evaluate((element) => {
    const { left, right, top, bottom } = element.getBoundingClientRect()
    return { left, right, top, bottom }
  })
}

/** The one toast on screen whose text starts with `prefix`, read from the page while it is up; throws when none is. */
async function toastBox(page: Page, prefix: string): Promise<Box> {
  const box = await page.evaluate((wanted) => {
    const toast = [...document.querySelectorAll('[role=status]')].find((element) => (element.textContent ?? '').startsWith(wanted))
    if (toast === undefined) return null
    const { left, right, top, bottom } = toast.getBoundingClientRect()
    return { left, right, top, bottom }
  }, prefix)
  if (box === null) throw new Error(`no toast starting with ${JSON.stringify(prefix)} is on screen`)
  return box
}

const pageScrollsSideways = (page: Page): Promise<boolean> =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)

// One business with one customer with a 60-character name and one sale owing: each width only reads layout
// and makes, then deletes, one payment.
test.describe.serial('the bar at four phone widths', () => {
  let page: Page
  let card = ''
  const consoleMessages: string[] = []

  test.beforeAll(async ({ browser, workerServer }) => {
    page = await (await withToastRecorder(browser.newContext({ ...PHONE_CONTEXT, baseURL: workerServer.url, viewport: PHONE }))).newPage()
    watchConsole(page, consoleMessages)
    await signUpNewBusiness(page)
    expect(LONG_NAME).toHaveLength(60)
    expect(LONG_NAME).toBe(LONG_NAME.trim())
    await seedLedger(page, LONG_NAME, 1)
    card = new URL(page.url()).pathname
  })

  test.afterAll(async () => {
    await page.context().close()
  })

  for (const width of WIDTHS) {
    test(`at ${width} px the tabs are equal widths on Home and on Customers, and the page does not scroll sideways`, async () => {
      await page.setViewportSize({ width, height: PHONE.height })
      for (const route of [HOME, CUSTOMERS]) {
        await page.goto(route)
        await expect(bottomBar(page)).toBeVisible()
        await expect(page.locator(BOTTOM_BAR_PLUS)).toHaveCount(1)
        const slots = await measureSlots(page)
        expect(slots.filter((slot) => slot.kind === 'tab')).toHaveLength(4)
        expect(equalWidthProblems(slots, width), `${route}\n${slotTable(slots, width, 'light')}`).toEqual([])
        expect(await pageScrollsSideways(page), `${route} scrolls sideways`).toBe(false)
      }
    })

    test(`at ${width} px the card's New sale action ends at or above the +, and the page does not scroll sideways`, async () => {
      await page.setViewportSize({ width, height: PHONE.height })
      await page.goto(card)
      const action = page.getByRole('link', { name: `${CUSTOMERS_TEXT.newSaleTo}${LONG_NAME}` })
      await expect(action).toBeVisible()
      await expect(page.locator(BOTTOM_BAR_PLUS)).toHaveCount(1)

      const actionBox = await rectOf(action)
      const plusBox = await rectOf(page.locator(BOTTOM_BAR_PLUS))
      expect(actionBox.bottom, `the action ends at ${actionBox.bottom}, the + starts at ${plusBox.top}`).toBeLessThanOrEqual(plusBox.top)
      expect(await pageScrollsSideways(page), 'the card scrolls sideways').toBe(false)
    })

    test(`at ${width} px a toast clears the bar and the + on Home, and the card's action and the + on the card`, async () => {
      await page.setViewportSize({ width, height: PHONE.height })
      await page.goto(HOME)
      await page.getByRole('link', { name: `Collect from ${LONG_NAME}` }).click()
      await page.getByLabel('Amount', { exact: true }).fill('100')
      await choosePaymentMethod(page, 'Cash')
      await expectToast(page, 'Payment saved · still owing $ 900', () => page.getByRole('button', { name: 'Save' }).click())
      await expect(bottomBar(page)).toBeVisible()
      const onHome = await toastBox(page, 'Payment saved')
      expect(intersects(onHome, await rectOf(bottomBar(page))), 'the toast overlaps the bar').toBe(false)
      expect(intersects(onHome, await rectOf(page.locator(BOTTOM_BAR_PLUS))), 'the toast overlaps the +').toBe(false)

      await page.goto(card)
      const action = page.getByRole('link', { name: `${CUSTOMERS_TEXT.newSaleTo}${LONG_NAME}` })
      await page.getByRole('button', { name: CUSTOMERS_TEXT.deletePayment }).click()
      await expectToast(page, CUSTOMERS_TEXT.paymentDeleted, () => page.getByRole('button', { name: 'Yes, delete it' }).click())
      const onCard = await toastBox(page, CUSTOMERS_TEXT.paymentDeleted)
      expect(intersects(onCard, await rectOf(action)), "the toast overlaps the card's action").toBe(false)
      expect(intersects(onCard, await rectOf(page.locator(BOTTOM_BAR_PLUS))), 'the toast overlaps the + on the card').toBe(false)
    })
  }

  test('the page logged nothing to the console', () => {
    expect(consoleMessages).toEqual([])
  })
})
