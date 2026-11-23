/**
 * The Owed summary card in a real phone browser (GH-831 part 2): its CSS is the only thing that
 * draws the bar widths, the stacked legend and the stacked total row, so only a browser can show
 * them. `GET /payments/debtors` (and, for two decimals, `GET /auth/me`) are answered by
 * `page.route`; the card is found by role and accessible name, never by class.
 *   - Bar: a $0 part is 0 px wide, every width is its share of the bar, and the parts fill it,
 *     also for a total under 1 at two decimals.
 *   - Skeleton: held, then released, it is as tall as the card (legend to 1 px, the card within
 *     one total-row line) at 390, 320 and 246 px, with the normal and the nine-digit amounts.
 *   - Legend: 390 px three columns with each amount over its word; 320 px with nine-digit
 *     amounts stacked, word left of amount; 246 px (320 at 130 % text) stacked, amount over word.
 */

import type { Locator, Page } from '@playwright/test'
import { CUSTOMERS } from '../src/routes.js'
import { expect, test, withToastRecorder } from './fixtures.js'
import { signUpNewBusiness } from './helpers/signup.js'

const SUMMARY = 'Summary of what customers owe'
const LINE_PX = 30

interface Buckets {
  this_week: number
  days_8_30: number
  over_30: number
}

const NORMAL: Buckets = { this_week: 12800, days_8_30: 20100, over_30: 24900 }
const NINE_DIGITS: Buckets = { this_week: 999999999, days_8_30: 888888888, over_30: 777777777 }

function body(total: number, buckets: Buckets) {
  return { total_owed: total, sales_owing_count: 0, customer_count: 0, debtor_count: 1, buckets, debtors: [{ customer: { id: 1, name: 'Ana' }, balance: total, owing_since: '2026-09-14', standing: 'owes', age_days: 1, bucket: 'this_week', customer_type_id: null, still_owing: null }] }
}

/** Answers the debtors read with `answer`, after `released` when given. */
async function stubDebtors(page: Page, answer: unknown, released?: Promise<void>): Promise<void> {
  await page.unroute('**/payments/debtors')
  await page.route('**/payments/debtors', async (route) => {
    if (released !== undefined) await released
    await route.fulfill({ json: answer })
  })
}

async function stubDecimals(page: Page, decimals: number): Promise<void> {
  await page.route('**/auth/me', async (route) => {
    const response = await route.fetch()
    const me = (await response.json()) as { money: Record<string, unknown> }
    await route.fulfill({ response, json: { ...me, money: { ...me.money, symbol: '$', decimals } } })
  })
}

async function box(locator: Locator) {
  const found = await locator.boundingBox()
  if (found === null) throw new Error('no box')
  return found
}

function line(page: Page, name: string): { word: Locator; amount: Locator } {
  const item = page.getByRole('region', { name: SUMMARY }).getByRole('listitem', { name })
  return { word: item.locator(':scope > span').first(), amount: item.locator(':scope > span').last() }
}

let page: Page

test.describe.serial('Owed summary card', () => {
  test.beforeAll(async ({ browser, workerServer }) => {
    test.setTimeout(120_000)
    page = await (
      await withToastRecorder(browser.newContext({ baseURL: workerServer.url, viewport: { width: 390, height: 844 } }))
    ).newPage()
    await signUpNewBusiness(page)
  })

  test.afterAll(async () => {
    await page.close()
  })

  async function open(buckets: Buckets, total: number): Promise<void> {
    await stubDebtors(page, body(total, buckets))
    await page.goto(CUSTOMERS)
    await expect(page.getByRole('region', { name: SUMMARY })).toBeVisible()
  }

  test('a $0 part is 0 px wide and the parts fill the bar', async () => {
    await open({ this_week: 12800, days_8_30: 0, over_30: 20200 }, 33000)

    const bar = page.getByRole('region', { name: SUMMARY }).locator('[aria-hidden="true"]').first()
    const parts = await bar.locator(':scope > span').evaluateAll((spans) => spans.map((span) => span.getBoundingClientRect().width))
    const whole = (await box(bar)).width
    expect(parts[1]).toBe(0)
    expect(parts[0]).toBeCloseTo((whole * 12800) / 33000, 0)
    expect(parts[2]).toBeCloseTo((whole * 20200) / 33000, 0)
    expect((parts[0] ?? 0) + (parts[2] ?? 0)).toBeCloseTo(whole, 0)
  })

  test('a total under 1 at two decimals still fills the bar', async () => {
    await stubDecimals(page, 2)
    await open({ this_week: 0.3, days_8_30: 0.2, over_30: 0 }, 0.5)

    await expect(page.getByRole('region', { name: SUMMARY }).getByRole('group', { name: 'Total owed' })).toContainText('$ 0,50')
    const bar = page.getByRole('region', { name: SUMMARY }).locator('[aria-hidden="true"]').first()
    const parts = await bar.locator(':scope > span').evaluateAll((spans) => spans.map((span) => span.getBoundingClientRect().width))
    const whole = (await box(bar)).width
    expect(parts[2]).toBe(0)
    expect((parts[0] ?? 0) + (parts[1] ?? 0)).toBeCloseTo(whole, 0)
    expect(parts[0]).toBeCloseTo((whole * 3) / 5, 0)
    await page.unroute('**/auth/me')
  })

  for (const [name, width] of [['390 px', 390], ['320 px', 320], ['246 px', 246]] as const) {
    for (const [label, buckets] of [['normal', NORMAL], ['nine-digit', NINE_DIGITS]] as const) {
      test(`the skeleton is as tall as the card at ${name}, ${label} amounts`, async () => {
        await page.setViewportSize({ width, height: 844 })
        const total = buckets.this_week + buckets.days_8_30 + buckets.over_30
        let release: () => void = () => undefined
        await stubDebtors(page, body(total, buckets), new Promise<void>((resolve) => { release = resolve }))
        await page.goto(CUSTOMERS)
        const skeleton = page.locator('[aria-hidden="true"]:has(ul)').first()
        await expect(skeleton).toBeVisible()
        const held = { card: await box(skeleton), legend: await box(skeleton.locator('ul')) }
        release()
        const region = page.getByRole('region', { name: SUMMARY })
        await expect(region).toBeVisible()
        const shown = { card: await box(region), legend: await box(region.locator('ul')) }
        expect(Math.abs(held.legend.height - shown.legend.height)).toBeLessThanOrEqual(1)
        expect(Math.abs(held.card.height - shown.card.height)).toBeLessThanOrEqual(LINE_PX)
      })
    }
  }

  test('390 px: three columns, each amount over its word', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await open(NORMAL, 57800)

    const tops = await Promise.all(['This week', '8–30 days', 'Over 30 days'].map(async (name) => (await box(line(page, name).word)).y))
    expect(Math.abs((tops[0] ?? 0) - (tops[1] ?? 0))).toBeLessThanOrEqual(1)
    expect(Math.abs((tops[1] ?? 0) - (tops[2] ?? 0))).toBeLessThanOrEqual(1)
    const { word, amount } = line(page, 'This week')
    expect((await box(amount)).y).toBeLessThan((await box(word)).y)
  })

  test('320 px with nine-digit amounts: stacked, word left of its amount', async () => {
    await page.setViewportSize({ width: 320, height: 844 })
    await open(NINE_DIGITS, 2666666664)

    const names = ['This week', '8–30 days', 'Over 30 days']
    const tops = await Promise.all(names.map(async (name) => (await box(line(page, name).word)).y))
    expect(tops[0]).toBeLessThan(tops[1] ?? 0)
    expect(tops[1]).toBeLessThan(tops[2] ?? 0)
    for (const name of names) {
      const { word, amount } = line(page, name)
      expect(Math.abs((await box(word)).y - (await box(amount)).y)).toBeLessThanOrEqual(1)
      expect((await box(word)).x).toBeLessThan((await box(amount)).x)
    }
  })

  test('246 px with nine-digit amounts: stacked, each amount over its word', async () => {
    await page.setViewportSize({ width: 246, height: 844 })
    await open(NINE_DIGITS, 2666666664)

    const names = ['This week', '8–30 days', 'Over 30 days']
    const tops = await Promise.all(names.map(async (name) => (await box(line(page, name).word)).y))
    expect(tops[0]).toBeLessThan(tops[1] ?? 0)
    expect(tops[1]).toBeLessThan(tops[2] ?? 0)
    for (const name of names) {
      const { word, amount } = line(page, name)
      expect((await box(amount)).y).toBeLessThan((await box(word)).y)
    }
  })
})
