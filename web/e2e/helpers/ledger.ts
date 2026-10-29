/**
 * `seedLedger`: a customer whose card carries `sales` sales left owing, made the way a seller
 * makes them — through the built front, never the API (GH-278, the card's pinned footer needs a
 * ledger long enough to scroll). It opens its own priced variety and the customer, then goes
 * round `sales` times: the card's "New sale to <name>", one line through `fillSaleLine`,
 * "Owing", "Save sale", back to the card. It ends on the card. It reads no clock; the caller
 * signs a business up first and picks the customer's name with `uniqueTag`.
 */

import { CUSTOMER, CUSTOMER_NEW, VARIETIES, pathTo } from '../../src/routes.js'
import { expect } from '../fixtures.js'
import type { Page } from '@playwright/test'
import { expectPath } from './url.js'
import { expectToast } from './toast.js'
import { fillSaleLine } from './sale.js'
import { uniqueTag } from './unique.js'

export async function seedLedger(page: Page, customerName: string, sales: number): Promise<void> {
  const variety = `Rosa ${uniqueTag()}`
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'New variety' }).click()
  await page.getByLabel('Name').fill(variety)
  await expectToast(page, 'Variety saved', () => page.getByRole('button', { name: 'Add the variety' }).click())
  await page.getByRole('link', { name: new RegExp(variety) }).click()
  await page.getByRole('link', { name: 'New price' }).click()
  await page.getByLabel(/^List price/).fill('1000')
  await expectToast(page, 'Price saved', () => page.getByRole('button', { name: 'Save the price' }).click())

  await page.goto(CUSTOMER_NEW)
  await page.getByLabel('Name').fill(customerName)
  await page.getByRole('button', { name: 'Save and use' }).click()
  await expectPath(page, CUSTOMER)
  const card = new URL(page.url()).pathname
  const id = /\/(\d+)$/.exec(card)?.[1]
  if (id === undefined) throw new Error(`no customer id in ${page.url()}`)

  for (let sale = 1; sale <= sales; sale += 1) {
    await page.goto(pathTo(CUSTOMER, { id }))
    await page.getByRole('link', { name: `New sale to ${customerName}` }).click()
    await fillSaleLine(page, 1, { variety, grams: String(sale) })
    await page.getByRole('radio', { name: 'Owing' }).check()
    await page.getByRole('button', { name: 'Save sale' }).click()
    await expect(page.getByText('Sale saved')).toBeVisible()
  }

  await page.goto(pathTo(CUSTOMER, { id }))
  await expect(page.locator('.cuenta-cliente__fila')).toHaveCount(sales)
}
