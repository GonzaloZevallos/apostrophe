/**
 * The long lists `scrollOnNavigate.spec.ts` scrolls (GH-480): a fresh business with Rosa priced,
 * and `LONG` customers ("Zeta 01" ...) who each owe one sale of Rosa, so Customers and Sales are
 * taller than any viewport the spec uses. The business and Rosa go through the
 * built front; the volume goes through the session's own requests (`page.request`), the way
 * `customerSheet.spec.ts` and `cobroHoja.spec.ts` do.
 */

import type { Page } from '@playwright/test'
import { VARIETIES } from '../../src/routes.js'
import { expect } from '../fixtures.js'
import { signUpNewBusiness } from './signup.js'
import { expectToast } from './toast.js'

/** How many customers, sales or varieties a long list has. */
export const LONG = 40

/** Requests in flight at once: enough to be quick, few enough for SQLite. */
const BATCH = 8

function numbered(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix} ${String(index + 1).padStart(2, '0')}`)
}

async function inBatches<T>(items: readonly T[], run: (item: T) => Promise<void>): Promise<void> {
  for (let start = 0; start < items.length; start += BATCH) {
    await Promise.all(items.slice(start, start + BATCH).map(run))
  }
}

/** Signs a new business up and gives it Rosa with a price, through the front. */
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
  const me: { today: string } = await (await page.request.get('/auth/me')).json()
  const varieties: { id: number; name: string }[] = await (await page.request.get(`/api/products?on=${me.today}`)).json()
  const rosa = varieties.find((variety) => variety.name === 'Rosa')
  if (rosa === undefined) throw new Error('Rosa missing from GET /api/products')
  return rosa.id
}

async function owingSale(page: Page, customerId: number, varietyId: number): Promise<void> {
  const sold = await page.request.post('/sales', {
    data: {
      customer_id: customerId,
      payment: 'owing',
      lines: [{ product_id: varietyId, quantity: '1', gift: false, special_price: null }],
    },
  })
  expect(sold.ok(), await sold.text()).toBe(true)
}

/** A new business whose Customers and Sales lists are `LONG` rows each. */
export async function seedLongLists(page: Page): Promise<void> {
  await businessWithRosa(page)
  const rosa = await rosaId(page)
  const ids: number[] = []
  await inBatches(numbered('Zeta', LONG), async (name) => {
    const created = await page.request.post('/customers', { data: { name, phone: null, vip: false } })
    expect(created.ok(), await created.text()).toBe(true)
    const customer: { id: number } = await created.json()
    ids.push(customer.id)
  })
  // One at a time: two sales saved together can claim the same sale number and one fails with a 500.
  for (const id of ids) await owingSale(page, id, rosa)
}

/** `LONG` more varieties ("Tulipan 01" ...), so Home's stock list is taller than any viewport. */
export async function seedLongVarieties(page: Page): Promise<void> {
  await inBatches(numbered('Tulipan', LONG), async (name) => {
    const created = await page.request.post('/api/products', { data: { name } })
    expect(created.ok(), await created.text()).toBe(true)
  })
}

/** `LONG` expenses ("Gasto 01" ...) dated on the business's own today, so Expenses scrolls. */
export async function seedLongExpenses(page: Page): Promise<void> {
  const me: { today: string } = await (await page.request.get('/auth/me')).json()
  const categories: { id: number }[] = await (await page.request.get('/expense-categories')).json()
  const category = categories[0]
  if (category === undefined) throw new Error('a new business has no expense category')
  await inBatches(numbered('Gasto', LONG), async (detail) => {
    const recorded = await page.request.post('/expenses', {
      data: { spent_on: me.today, category_id: category.id, amount: 4500, detail },
    })
    expect(recorded.status()).toBe(201)
  })
}
