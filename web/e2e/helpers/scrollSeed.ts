/**
 * The long lists `scrollOnNavigate.spec.ts` scrolls (GH-480): a fresh business with Rosa priced
 * and in stock, and `LONG` customers ("Zeta 01" ...) who each owe one sale of Rosa, so Customers
 * and Sales are taller than any viewport the spec uses. The business and Rosa's price go
 * through the built front; the volume goes through the session's own requests (`page.request`),
 * sent with master's current schemas (`app/sales/adapters/schemas.py`: a sale line is
 * `{ variety_id, quantity, gift, special_price }`; `app/customers/adapters/schemas.py`;
 * `app/stock/adapters/schemas.py`: an entry is `{ variety_id, origin, quantity }`). Every
 * response is asserted `ok`, so a schema that moved fails here and not three steps later.
 */

import type { APIResponse, Page } from '@playwright/test'
import { VARIETIES } from '../../src/routes.js'
import { expect } from '../fixtures.js'
import { signUpNewBusiness } from './signup.js'
import { expectToast } from './toast.js'

/** How many customers (and owing sales) the long lists have. */
export const LONG = 40

/** Requests in flight at once: enough to be quick, few enough for SQLite. */
const BATCH = 8

/** The page is taller than two viewports, or this fails with its own message. */
export async function expectLongPage(page: Page): Promise<void> {
  const { scrollHeight, innerHeight } = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  }))
  expect(scrollHeight, `the page must be long enough to scroll (scrollHeight ${scrollHeight}, innerHeight ${innerHeight})`).toBeGreaterThanOrEqual(
    2 * innerHeight,
  )
}

async function okJson<T>(response: APIResponse): Promise<T> {
  expect(response.ok(), `${response.url()} answered ${response.status()}: ${await response.text()}`).toBe(true)
  return (await response.json()) as T
}

async function businessWithRosa(page: Page): Promise<void> {
  await signUpNewBusiness(page)
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'New variety' }).click()
  await page.getByLabel('Name').fill('Rosa')
  await expectToast(page, 'Variety saved', () => page.getByRole('button', { name: 'Add the variety' }).click())
  await page.getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('link', { name: 'New price' }).click()
  await page.getByLabel(/^List price/).fill('1000')
  await expectToast(page, 'Price saved', () => page.getByRole('button', { name: 'Save the price' }).click())
}

async function rosaId(page: Page): Promise<number> {
  const me = await okJson<{ today: string }>(await page.request.get('/auth/me'))
  const varieties = await okJson<{ id: number; name: string }[]>(await page.request.get(`/varieties?on=${me.today}`))
  const rosa = varieties.find((variety) => variety.name === 'Rosa')
  if (rosa === undefined) throw new Error('Rosa missing from GET /varieties')
  return rosa.id
}

async function customerOwing(page: Page, name: string, rosa: number): Promise<void> {
  const customer = await okJson<{ id: number }>(await page.request.post('/customers', { data: { name, phone: null, vip: false } }))
  await okJson(
    await page.request.post('/sales', {
      data: {
        customer_id: customer.id,
        payment: 'owing',
        lines: [{ variety_id: rosa, quantity: '1', gift: false, special_price: null }],
      },
    }),
  )
}

/** A new business whose Customers and Sales lists are `LONG` rows each, with Rosa priced and in stock. */
export async function seedLongLists(page: Page): Promise<void> {
  await businessWithRosa(page)
  const rosa = await rosaId(page)
  await okJson(await page.request.post('/stock/entries', { data: { variety_id: rosa, origin: 'harvest', quantity: '100000' } }))
  const names = Array.from({ length: LONG }, (_, index) => `Zeta ${String(index + 1).padStart(2, '0')}`)
  for (let start = 0; start < names.length; start += BATCH) {
    await Promise.all(names.slice(start, start + BATCH).map((name) => customerOwing(page, name, rosa)))
  }
}

/** `LONG` expenses ("Gasto 01" ...) dated on the business's own today, so Expenses scrolls (an in-page sheet opens from a row). */
export async function seedLongExpenses(page: Page): Promise<void> {
  const me = await okJson<{ today: string }>(await page.request.get('/auth/me'))
  const categories = await okJson<{ id: number }[]>(await page.request.get('/expense-categories'))
  const category = categories[0]
  if (category === undefined) throw new Error('a new business has no expense category')
  const details = Array.from({ length: LONG }, (_, index) => `Gasto ${String(index + 1).padStart(2, '0')}`)
  for (let start = 0; start < details.length; start += BATCH) {
    await Promise.all(
      details.slice(start, start + BATCH).map(async (detail) => {
        const recorded = await page.request.post('/expenses', {
          data: { spent_on: me.today, category_id: category.id, amount: 4500, detail },
        })
        expect(recorded.status(), `POST /expenses answered ${recorded.status()}: ${await recorded.text()}`).toBe(201)
      }),
    )
  }
}

/** One paid sale of Rosa with no customer, so its page offers "Assign customer" (a sheet with a history entry). Returns its id. */
export async function seedAnonymousSale(page: Page): Promise<number> {
  const rosa = await rosaId(page)
  const sale = await okJson<{ id: number }>(
    await page.request.post('/sales', {
      data: {
        customer_id: null,
        payment: 'cash',
        lines: [{ variety_id: rosa, quantity: '1', gift: false, special_price: null }],
      },
    }),
  )
  return sale.id
}
