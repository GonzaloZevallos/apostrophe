/**
 * The type-name badge of a line priced by a Customer type (`sales.md`, invariant "the type-name
 * badge truncates with an ellipsis, and its full name stays its DOM text"), in a browser: a
 * Customer in a type with a 40-character name, in New sale's preview and in the Sale detail,
 * at 320 px and 246 px wide. The page must not scroll sideways, the badge ends in an ellipsis
 * while its text is the whole name, and the figures beside it (price per gram, line total)
 * stay on one line.
 *
 * The backend cannot make a type of this shape through the built front (the VIP type is made
 * by the upgrade or the import), so the records are the real ones a seller makes (a priced
 * product, a Customer, a Sale) and the four answers that carry the type are patched in
 * flight: the switch, the types list, the Customer's type and the product's type price. The
 * Sale detail answers the saved line as a `type` line with the name copy.
 */

import type { Page, Route } from '@playwright/test'
import { CUSTOMER, SALE, pathTo } from '../src/routes.js'
import { expect, test } from './fixtures.js'
import { signUp, seedRecords } from './helpers/seed.js'
import { fillSaleLine } from './helpers/sale.js'

const TYPE_ID = 9
// Forty wide letters: wider than the phone however the row is laid out.
const TYPE_NAME = 'MWMWMWMWMWMWMWMWMWMWMWMWMWMWMWMWMWMWMWMW'
const CUSTOMER_NAME = 'Marta Quispe'
const SIZES = [
  { width: 320, height: 568 },
  { width: 246, height: 437 },
] as const

type Json = Record<string, unknown>

/** Answers the fetch for real, then hands its JSON body to `patch` and sends back the result. */
async function patched(route: Route, patch: (body: unknown) => unknown): Promise<void> {
  const response = await route.fetch()
  await route.fulfill({ response, json: patch(await response.json()) })
}

function withCustomerType(body: unknown): unknown {
  const give = (customer: Json): Json => ({ ...customer, customer_type_id: TYPE_ID })
  return Array.isArray(body) ? body.map((customer) => give(customer as Json)) : give(body as Json)
}

function withTypePrice(body: unknown): unknown {
  if (!Array.isArray(body)) return body
  return body.map((product) => {
    const price = (product as Json).current_price as Json | null
    return price === null
      ? product
      : { ...(product as Json), current_price: { ...price, type_prices: [{ customer_type_id: TYPE_ID, price: 800 }] } }
  })
}

function withTypeLine(body: unknown): unknown {
  const sale = body as Json & { lines: Json[] }
  const line = { ...sale.lines[0], pricing_rule: 'type', customer_type_name: TYPE_NAME, price_per_gram: 800 }
  return { ...sale, lines: [line, ...sale.lines.slice(1)] }
}

async function carryTheType(page: Page, saleId: number): Promise<void> {
  await page.route('**/*', async (route) => {
    const request = route.request()
    if (request.resourceType() !== 'fetch' || request.method() !== 'GET') return route.fallback()
    const path = new URL(request.url()).pathname
    if (path === '/pricing-settings') {
      return patched(route, (body) => ({ ...(body as Json), is_vip_customers: true }))
    }
    if (path === '/api/customer-types') {
      return route.fulfill({ json: [{ id: TYPE_ID, name: TYPE_NAME, icon: 'star', is_vip: true }] })
    }
    if (path === '/api/products') return patched(route, withTypePrice)
    if (path === '/customers' || /^\/customers\/\d+$/.test(path)) return patched(route, withCustomerType)
    if (path === `/sales/${saleId}`) return patched(route, withTypeLine)
    return route.fallback()
  })
}

/** The badge fits its row at the page's width: no sideways scroll, an ellipsis on the name, the
 * whole name as its text, and the figures beside it each on one line. */
async function expectBadgeFits(page: Page): Promise<void> {
  const badge = page.getByText(TYPE_NAME, { exact: true }).first()
  await expect(badge).toBeVisible()
  await expect(badge).toHaveText(TYPE_NAME)

  const measured = await badge.evaluate((element) => {
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    const figures = Array.from(element.parentElement?.children ?? [])
      .filter((sibling) => sibling !== element)
      .map((sibling) => {
        const siblingStyle = getComputedStyle(sibling)
        return sibling.getBoundingClientRect().height < parseFloat(siblingStyle.fontSize) * 2.2
      })
    return {
      textOverflow: style.textOverflow,
      cut: element.scrollWidth > element.clientWidth,
      right: rect.right,
      pageWidth: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      figuresOnOneLine: figures,
    }
  })

  expect(measured.pageWidth).toBeLessThanOrEqual(measured.viewport)
  expect(measured.right).toBeLessThanOrEqual(measured.viewport)
  expect(measured.textOverflow).toBe('ellipsis')
  expect(measured.cut).toBe(true)
  expect(measured.figuresOnOneLine.every(Boolean)).toBe(true)
}

test('a line priced by a customer type shows its long name with an ellipsis in New sale and in the Sale detail, at 320 px and 246 px', async ({
  page,
}) => {
  await signUp(page, 'tipo')
  const records = await seedRecords(page, CUSTOMER_NAME)
  await carryTheType(page, records.sale)

  await page.goto(pathTo(CUSTOMER, { id: records.customer }))
  await page.getByRole('link', { name: `New sale to ${CUSTOMER_NAME}` }).click()
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '5' })
  for (const size of SIZES) {
    await page.setViewportSize(size)
    await expectBadgeFits(page)
  }

  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto(pathTo(SALE, { id: records.sale }))
  for (const size of SIZES) {
    await page.setViewportSize(size)
    await expectBadgeFits(page)
  }
})
