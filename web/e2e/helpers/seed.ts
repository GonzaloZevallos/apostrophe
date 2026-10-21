/**
 * The records the navigation specs need to reach a detail by its id: one priced variety, one
 * customer owing a sale, one stock entry and one stock withdrawal, all made through the built front, never through
 * the API. `signUp` opens a fresh business; `seedRecords` returns the ids it read from the
 * address bar after each save.
 */

import {
  CUSTOMER,
  CUSTOMER_NEW,
  SALE,
  STOCK,
  STOCK_ENTRY,
  STOCK_ENTRY_NEW,
  VARIETIES,
  VARIETY,
  WITHDRAWAL,
  pathTo,
  withdrawalNewFor,
} from '../../src/routes.js'
import { expect } from '../fixtures.js'
import type { Page } from '@playwright/test'
import { newBusinessInvitationUrl } from '../backend.js'
import { expectPath } from './url.js'
import { fillSaleLine } from './sale.js'
import { leaveOnboarding } from './signup.js'
import { uniqueTag } from './unique.js'

export const PASSWORD = 'correcthorsebattery'

export interface Records {
  variety: number
  customer: number
  sale: number
  entry: number
  withdrawal: number
  customerName: string
}

export async function signUp(page: Page, label: string): Promise<void> {
  await page.goto(newBusinessInvitationUrl())
  await page.getByLabel('Business name').fill(`Flores de ${label} ${uniqueTag()}`)
  await page.getByLabel('Email').fill(`duena-${label}-${uniqueTag()}@example.com`)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Creá el negocio' }).click()
  // A new business lands in the Onboarding; this spec is about something else.
  await leaveOnboarding(page)
}

/** The id the address bar ends in, once it matches `template`. */
async function idAt(page: Page, template: string): Promise<number> {
  await expectPath(page, template)
  const found = /\/(\d+)(?:\/[a-z]+)?$/.exec(new URL(page.url()).pathname)
  if (found?.[1] === undefined) throw new Error(`no id in ${page.url()}`)
  return Number(found[1])
}

export async function seedRecords(page: Page, customerName: string): Promise<Records> {
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'New variety' }).click()
  await page.getByLabel('Name').fill('Rosa')
  await page.getByRole('button', { name: 'Add the variety' }).click()
  await expect(page.getByText('Variety saved')).toBeVisible()
  await page.getByRole('link', { name: /Rosa/ }).click()
  const variety = await idAt(page, VARIETY)
  await page.getByRole('link', { name: 'New price' }).click()
  await page.getByLabel(/^List price/).fill('1000')
  await page.getByRole('button', { name: 'Save the price' }).click()
  await expect(page.getByText('Price saved')).toBeVisible()

  await page.goto(CUSTOMER_NEW)
  await page.getByLabel('Name').fill(customerName)
  await page.getByRole('button', { name: 'Guardá y usá' }).click()
  const customer = await idAt(page, CUSTOMER)
  await page.getByRole('link', { name: `Nueva venta a ${customerName}` }).click()
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '5' })
  await page.getByRole('radio', { name: 'Owing' }).check()
  await page.getByRole('button', { name: 'Guardá la venta' }).click()
  const sale = await idAt(page, SALE)

  await page.goto(STOCK_ENTRY_NEW)
  await page.getByLabel('Grams').fill('50')
  await page.getByLabel('Variety').selectOption({ label: 'Rosa' })
  await page.getByLabel('Total cost').fill('45000')
  await page.getByRole('button', { name: 'Save the entry' }).click()
  await expect(page.getByText('Entry saved')).toBeVisible()
  await page.goto(STOCK)
  await page.getByRole('link', { name: 'Edit' }).click()
  const entry = await idAt(page, STOCK_ENTRY)

  await page.goto(withdrawalNewFor(variety))
  await page.getByLabel('Grams 1', { exact: true }).fill('1')
  await page.getByRole('button', { name: 'Promoción', exact: true }).click()
  await page.getByRole('button', { name: 'Save the withdrawal' }).click()
  await expect(page.getByText('Withdrawal saved')).toBeVisible()
  await page.goto(pathTo(VARIETY, { id: variety }))
  await page.locator('.fila-entrada__enlace', { hasText: 'Promoción' }).click()
  const withdrawal = await idAt(page, WITHDRAWAL)

  return { variety, customer, sale, entry, withdrawal, customerName }
}
