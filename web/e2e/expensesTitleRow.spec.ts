/**
 * Expenses' phone title row in a real phone browser (GH-1053 part 5), in the phone check's own
 * project (its server, pinned clock and seeded business; the run's language, `en` or `en-XA`,
 * applies with no carve-out): the round back, the title and Add expense share one line that
 * never wraps, with the month line below, and nothing scrolls sideways, from 246 CSS px (320 px at
 * 130 % text) to 430 px. The title is never cut, and every target is at least 44 x 44.
 * Behind the New expense Sheet on a direct address the title is where the screen puts it.
 */

import type { Page } from '@playwright/test'
import { expect, test } from './fixtures.js'
import { MOBILE_STATE_FILE } from './env.js'
import { applyTextScale, expectTextScaled, TEXT_SCALE } from './helpers/textScale.js'
import { newCell } from './mobile/cells.js'
import { guardWrites } from './mobile/network.js'
import { settle } from './mobile/walk.js'
import { ANALYSIS, EXPENSE_NEW, EXPENSES } from '../src/routes.ts'
import { expectPath } from './helpers/url.js'

const TOUCH = 44
const SUBPIXEL = 1

/** Each cell: the viewport width and the text scale. 246 is 320 at 130 %, as a width. */
const CELLS = [
  { width: 246, scale: 1 },
  { width: 320, scale: 1 },
  { width: 320, scale: TEXT_SCALE },
  { width: 375, scale: 1 },
  { width: 375, scale: TEXT_SCALE },
  { width: 430, scale: 1 },
  { width: 430, scale: TEXT_SCALE },
] as const

interface Rect {
  top: number
  bottom: number
  left: number
  right: number
  width: number
  height: number
}

interface Measure {
  back: Rect
  title: Rect
  action: Rect
  month: Rect
  rowScrollWidth: number
  rowClientWidth: number
  rowEm: number
  blockScrollWidth: number
  blockClientWidth: number
  viewportWidth: number
  titleScrollWidth: number
  titleClientWidth: number
}

async function openCell(browser: Parameters<typeof newCell>[0], width: number): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await newCell(browser, '320x568', 'claro', MOBILE_STATE_FILE)
  await guardWrites(context)
  const page = await context.newPage()
  await page.setViewportSize({ width, height: 800 })
  return { page, close: () => context.close() }
}

async function measure(page: Page): Promise<Measure> {
  return page.evaluate(() => {
    const rect = (element: Element): Rect => {
      const box = element.getBoundingClientRect()
      return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width, height: box.height }
    }
    const one = (selector: string): HTMLElement => {
      const found = document.querySelector<HTMLElement>(`main ${selector}`)
      if (found === null) throw new Error(`no ${selector}`)
      return found
    }
    const row = one('.gastos__fila-titulo')
    const title = one('.gastos__titulo')
    const block = one('.gastos__encabezado')
    return {
      back: rect(one('.flecha-atras--redonda .boton--enlace')),
      title: rect(title),
      action: rect(one('.gastos__cargar')),
      month: rect(one('.gastos__mes')),
      rowScrollWidth: row.scrollWidth,
      rowClientWidth: row.clientWidth,
      rowEm: row.clientWidth / parseFloat(getComputedStyle(row).fontSize),
      blockScrollWidth: block.scrollWidth,
      blockClientWidth: block.clientWidth,
      viewportWidth: document.documentElement.clientWidth,
      titleScrollWidth: title.scrollWidth,
      titleClientWidth: title.clientWidth,
    }
  })
}

for (const { width, scale } of CELLS) {
  test(`the title row is one line, fits and is thumb-sized at ${width} px, text at ${Math.round(scale * 100)} %`, async ({ browser }) => {
    const { page, close } = await openCell(browser, width)
    await page.goto(EXPENSES)
    await settle(page)
    await expect(page.getByRole('button', { name: /Analysis/ })).toBeVisible()
    if (scale !== 1) {
      const scaled = await applyTextScale(page, 'body', scale)
      await expectTextScaled(page, scaled, scale)
    }

    const found = await measure(page)
    const where = `${width} px at ${scale}: ${found.rowEm.toFixed(2)} em`
    for (const part of [found.back, found.action]) {
      expect(Math.abs(part.top + part.height / 2 - (found.title.top + found.title.height / 2)), `${where}: one line`).toBeLessThanOrEqual(SUBPIXEL)
    }
    expect(found.back.right, `${where}: back, then title`).toBeLessThanOrEqual(found.title.left + SUBPIXEL)
    expect(found.title.right, `${where}: title, then action`).toBeLessThanOrEqual(found.action.left + SUBPIXEL)
    expect(found.month.top, `${where}: the month line is below the row`).toBeGreaterThanOrEqual(Math.max(found.back.bottom, found.action.bottom) - SUBPIXEL)
    expect(found.rowScrollWidth, `${where}: the row does not scroll`).toBeLessThanOrEqual(found.rowClientWidth)
    // The title block (the row and the month line), not the whole page: below it `MonthBody`, which this
    // part does not touch, draws the seeded month's 2.000.226.9xx total, wider than a phone at 130 % text.
    expect(found.blockScrollWidth, `${where}: the title block does not scroll sideways`).toBeLessThanOrEqual(found.blockClientWidth)
    for (const part of [found.back, found.title, found.action, found.month]) {
      expect(part.right, `${where}: inside the viewport`).toBeLessThanOrEqual(found.viewportWidth + SUBPIXEL)
    }
    expect(found.titleScrollWidth, `${where}: the title is whole`).toBeLessThanOrEqual(found.titleClientWidth)
    for (const [name, part] of [['back', found.back], ['action', found.action]] as const) {
      expect(part.width, `${where}: ${name} width`).toBeGreaterThanOrEqual(TOUCH - 0.5)
      expect(part.height, `${where}: ${name} height`).toBeGreaterThanOrEqual(TOUCH - 0.5)
    }
    await expect(page.getByRole('button', { name: /Analysis/ })).toBeVisible()
    await close()
  })
}

test('a tap on the back lands on Analysis, and Add expense opens the form', async ({ browser }) => {
  const { page, close } = await openCell(browser, 246)
  await page.goto(EXPENSES)
  await settle(page)
  await page.getByRole('button', { name: /Analysis/ }).click()
  await expectPath(page, ANALYSIS)

  await page.goto(EXPENSES)
  await settle(page)
  await page.getByRole('main').getByRole('link', { name: 'Add expense' }).click()
  await expectPath(page, EXPENSE_NEW)
  await close()
})

for (const width of [246, 320, 375, 430]) {
  test(`behind the New expense Sheet, the title is where Expenses puts it at ${width} px`, async ({ browser }) => {
    const { page, close } = await openCell(browser, width)
    await page.goto(EXPENSES)
    await settle(page)
    const onScreen = await page.getByRole('main').getByText('Expenses', { exact: true }).boundingBox()
    expect(onScreen, 'the title is on the screen').not.toBeNull()

    await page.goto(EXPENSE_NEW)
    await settle(page)
    const behind = page.locator('[inert]').getByText('Expenses', { exact: true })
    await expect(behind).toBeVisible()
    const underSheet = await behind.boundingBox()
    expect(Math.abs((underSheet?.y ?? -1) - (onScreen?.y ?? 0)), 'top').toBeLessThanOrEqual(SUBPIXEL)
    expect(Math.abs((underSheet?.x ?? -1) - (onScreen?.x ?? 0)), 'left').toBeLessThanOrEqual(SUBPIXEL)
    await close()
  })
}
