/**
 * The Products phone title row (GH-1182): "Products", the New product action and the Settings
 * avatar share one row at every measured phone cell, and the action is the neutral round "+"
 * (never the green fill next to the green avatar).
 *
 * Six cells, each in its own browser context and navigation from one seeded business: 320 px,
 * 246 px (the narrowest phone) and 320 px with the text at 130 %, each in light and dark. Every
 * cell attaches the table of what it measured, so the shortfall of a look that does not fit can
 * be read from the run. Colours are never compared as text: each token is resolved through a
 * probe element's computed style, so the assertion follows the theme and not a literal.
 */

import type { Browser, BrowserContext, Page } from '@playwright/test'
import { expect, test, withToastRecorder } from './fixtures.js'
import { signUp, seedRecords } from './helpers/seed.js'
import {
  LOADING_MARKER,
  PHONE_CONTEXT,
  TEXT_SCALE,
  applyTextScale,
  expectNoSidewaysOverflow,
  expectTextScaled,
  expectThumbSized,
} from './helpers/textScale.js'
import { VARIETIES, VARIETY_NEW } from '../src/routes.js'

test.use(PHONE_CONTEXT)

const HEIGHT = 700
const TARGET = 44
const MIN_GAP = 8
const TOLERANCE = 0.5

interface Cell {
  width: number
  scale: number
  theme: 'light' | 'dark'
}

const CELLS: Cell[] = (['light', 'dark'] as const).flatMap((theme) => [
  { width: 320, scale: 1, theme },
  { width: 246, scale: 1, theme },
  { width: 320, scale: TEXT_SCALE, theme },
])

interface Box {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
}

interface Row {
  available: number
  needed: number
  gaps: number[]
  title: { scrollWidth: number; clientWidth: number }
  boxes: { title: Box; action: Box; avatar: Box }
}

/** The title row as it lays out now: natural widths, the boxes, the gaps between neighbours and the title's clip. */
async function measureRow(page: Page): Promise<Row> {
  return page.locator('.productos-cabecera').evaluate((row) => {
    const read = (element: Element): Box => {
      const { left, right, top, bottom, width, height } = element.getBoundingClientRect()
      return { left, right, top, bottom, width, height }
    }
    const title = row.querySelector('h1')
    const action = row.querySelector('a[aria-label="New product"]')
    const avatar = row.querySelector('a[aria-label="Settings"]')
    if (title === null || action === null || avatar === null) throw new Error('the title row lacks its title, action or avatar')
    const boxes = { title: read(title), action: read(action), avatar: read(avatar) }
    const gaps = [boxes.action.left - boxes.title.right, boxes.avatar.left - boxes.action.right]
    // The title is the one child that shrinks: its natural width is its text, measured with a Range.
    const range = document.createRange()
    range.selectNodeContents(title)
    const natural = range.getBoundingClientRect().width
    const gap = parseFloat(getComputedStyle(row).columnGap)
    const needed = natural + boxes.action.width + boxes.avatar.width + gap * 2
    return {
      available: row.getBoundingClientRect().width,
      needed,
      gaps,
      title: { scrollWidth: title.scrollWidth, clientWidth: title.clientWidth },
      boxes,
    }
  })
}

function table(cell: Cell, row: Row): string {
  const box = (name: string, value: Box): string =>
    `| ${name} | ${value.left.toFixed(2)} | ${value.width.toFixed(2)} | ${value.height.toFixed(2)} |`
  return [
    `| cell | available | needed | shortfall | gap title-action | gap action-avatar | h1 scrollWidth/clientWidth |`,
    `|---|---|---|---|---|---|---|`,
    `| ${cell.width} x${cell.scale} ${cell.theme} | ${row.available.toFixed(2)} | ${row.needed.toFixed(2)} | ${Math.max(0, row.needed - row.available).toFixed(2)} | ${row.gaps[0]?.toFixed(2)} | ${row.gaps[1]?.toFixed(2)} | ${row.title.scrollWidth}/${row.title.clientWidth} |`,
    '',
    '| box | left | width | height |',
    '|---|---|---|---|',
    box('h1', row.boxes.title),
    box('New product', row.boxes.action),
    box('Settings', row.boxes.avatar),
  ].join('\n')
}

/** The colour a token resolves to under the page's current theme, read from a probe's computed style. */
async function resolveToken(page: Page, name: string, property: 'color' | 'backgroundColor'): Promise<string> {
  return page.evaluate(
    ({ token, prop }) => {
      const probe = document.createElement('span')
      probe.style[prop] = `var(${token})`
      document.querySelector('.productos-cabecera')?.appendChild(probe)
      const resolved = getComputedStyle(probe)[prop]
      probe.remove()
      return resolved
    },
    { token: name, prop: property },
  )
}

/** Why the row does not hold, one line each; empty when it is one whole row at this cell. */
function rowProblems(row: Row): string[] {
  const { title, action, avatar } = row.boxes
  const found: string[] = []
  const sameRow = (a: Box, b: Box): boolean => a.top < b.bottom && b.top < a.bottom
  if (!sameRow(title, action) || !sameRow(action, avatar)) found.push('the title, the action and the avatar are not on one row')
  row.gaps.forEach((gap, index) => {
    if (gap < MIN_GAP - TOLERANCE) found.push(`gap ${index === 0 ? 'title-action' : 'action-avatar'} is ${gap.toFixed(2)} px, under ${MIN_GAP}`)
  })
  for (const [name, box] of [['action', action], ['avatar', avatar]] as const) {
    if (box.width < TARGET - TOLERANCE || box.height < TARGET - TOLERANCE) {
      found.push(`${name} is ${box.width.toFixed(2)} x ${box.height.toFixed(2)}, under ${TARGET}`)
    }
  }
  if (row.title.scrollWidth > row.title.clientWidth) {
    found.push(`the title is clipped: scrollWidth ${row.title.scrollWidth} over clientWidth ${row.title.clientWidth}`)
  }
  return found
}

test('the row check rejects a clipped title, a gap under 8 px, a small action and a wrapped row', () => {
  const box = (left: number, top: number, width: number, height: number): Box => ({
    left,
    right: left + width,
    top,
    bottom: top + height,
    width,
    height,
  })
  const whole: Row = {
    available: 272,
    needed: 200,
    gaps: [12, 8],
    title: { scrollWidth: 90, clientWidth: 90 },
    boxes: { title: box(0, 0, 90, 44), action: box(102, 0, 44, 44), avatar: box(154, 0, 44, 44) },
  }
  expect(rowProblems(whole)).toEqual([])
  expect(
    rowProblems({
      ...whole,
      gaps: [12, 4],
      title: { scrollWidth: 95, clientWidth: 90 },
      boxes: { ...whole.boxes, action: box(102, 0, 40, 44), avatar: box(154, 60, 44, 44) },
    }),
  ).toEqual([
    'the title, the action and the avatar are not on one row',
    'gap action-avatar is 4.00 px, under 8',
    'action is 40.00 x 44.00, under 44',
    'the title is clipped: scrollWidth 95 over clientWidth 90',
  ])
})

test.describe('the Products phone title row', () => {
  let session: Awaited<ReturnType<BrowserContext['storageState']>>

  test.beforeAll(async ({ browser, workerServer }) => {
    const context = await withToastRecorder(
      browser.newContext({ ...PHONE_CONTEXT, baseURL: workerServer.url, viewport: { width: 375, height: 812 } }),
    )
    const page = await context.newPage()
    await signUp(page, 'products-header')
    await seedRecords(page, 'Ana Flores')
    session = await context.storageState()
    await context.close()
  })

  async function openCell(browser: Browser, baseURL: string, cell: Cell): Promise<{ context: BrowserContext; page: Page }> {
    const context = await withToastRecorder(
      browser.newContext({
        ...PHONE_CONTEXT,
        baseURL,
        viewport: { width: cell.width, height: HEIGHT },
        colorScheme: cell.theme,
        storageState: session,
      }),
    )
    const page = await context.newPage()
    await page.goto(VARIETIES)
    await expect(page.getByRole('heading', { level: 1, name: 'Products' })).toBeVisible()
    await expect(page.locator(LOADING_MARKER)).toHaveCount(0)
    return { context, page }
  }

  for (const cell of CELLS) {
    const name = `${cell.width}-${cell.scale}-${cell.theme}`
    test(`at ${cell.width} px, text at ${Math.round(cell.scale * 100)} %, in ${cell.theme}: one row, neutral round New product`, async ({ browser, workerServer }) => {
      const { context, page } = await openCell(browser, workerServer.url, cell)
      try {
        const dark = await page.evaluate(() => document.documentElement.getAttribute('data-tema') === 'oscuro')
        expect(dark, 'the page follows the emulated scheme').toBe(cell.theme === 'dark')

        const scaled = cell.scale === 1 ? [] : await applyTextScale(page, '.productos-cabecera', cell.scale)
        if (cell.scale !== 1) await expectTextScaled(page, scaled, cell.scale)
        const row = await measureRow(page)
        if (cell.scale !== 1) await expectTextScaled(page, scaled, cell.scale)
        await test.info().attach(`products-header-${name}`, { body: table(cell, row), contentType: 'text/markdown' })

        expect(rowProblems(row)).toEqual([])
        await expectNoSidewaysOverflow(page, `Products at ${name}`, cell.scale)
        await expectThumbSized(page, `Products at ${name}`, cell.scale)

        const action = page.getByRole('link', { name: 'New product' })
        await expect(action).toBeVisible()
        await expect(action).toHaveAttribute('href', VARIETY_NEW)

        // The neutral round +: a 1 px border in --linea, --superficie fill, --tinta ink, never --boton.
        const [linea, superficie, tinta, boton] = [
          await resolveToken(page, '--linea', 'color'),
          await resolveToken(page, '--superficie', 'backgroundColor'),
          await resolveToken(page, '--tinta', 'color'),
          await resolveToken(page, '--boton', 'backgroundColor'),
        ]
        expect(boton, 'the green and the surface differ in this theme').not.toBe(superficie)
        await expect(action).toHaveCSS('border-top-width', '1px')
        await expect(action).toHaveCSS('border-top-color', linea)
        await expect(action).toHaveCSS('background-color', superficie)
        await expect(action).toHaveCSS('color', tinta)
        const fill = await action.evaluate((link) => getComputedStyle(link).backgroundColor)
        expect(fill, 'the action is never the green fill').not.toBe(boton)
        await expect(action).toHaveText('')
      } finally {
        await context.close()
      }
    })
  }
})
