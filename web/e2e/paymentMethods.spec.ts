/**
 * Payment methods end to end, from a phone (GH-407): a seller opens Settings → Payments and
 * expenses → Payment methods (three taps from a Tab root), adds a method with an icon, edits it
 * and reopens the Sheet to find the saved name and icon (not the default), deletes a method that
 * no payment uses, and archives and restores one that a payment uses. Roles, names and text only.
 */

import type { Locator } from '@playwright/test'
import { CUSTOMER, CUSTOMERS, CUSTOMER_NEW, HOME, SALE_NEW, SETTINGS_PAYMENT_METHODS, VARIETIES } from '../src/routes.js'
import { choosePaymentMethod, expect, test } from './fixtures.js'
import { fillSaleLine } from './helpers/sale.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { expectToast } from './helpers/toast.js'
import { expectPath } from './helpers/url.js'

test.use({ viewport: { width: 390, height: 844 } })

const TAP_BUDGET_TO_THE_LIST = 3

interface Counter {
  taps: number
}

async function tap(counter: Counter, target: Locator): Promise<void> {
  counter.taps += 1
  await target.click()
}

test('a seller adds, edits, deletes, archives and restores payment methods in Settings', async ({ page }) => {
  await signUpNewBusiness(page)

  // A priced product, a customer and a sale left owing, so that Cash gets a payment below.
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'New product' }).click()
  await page.getByLabel('Name').fill('Rosa')
  await expectToast(page, 'Product saved', () => page.getByRole('button', { name: 'Add the product' }).click())
  await page.getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('link', { name: 'New price' }).click()
  await page.getByLabel(/^List price/).fill('1000')
  await expectToast(page, 'Price saved', () => page.getByRole('button', { name: 'Save the price' }).click())
  await page.goto(CUSTOMER_NEW)
  await page.getByLabel('Phone', { exact: true }).fill('+5491155550077')
  await page.getByLabel('Name').fill('Carla Métodos')
  await expectToast(page, 'Customer saved', () => page.getByRole('button', { name: 'Save and use' }).click())
  await expectPath(page, CUSTOMER)
  await page.getByRole('link', { name: 'New sale to Carla Métodos' }).click()
  await expectPath(page, SALE_NEW)
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '5' })
  await page.getByRole('radio', { name: 'Owing' }).check()
  await page.getByRole('button', { name: 'Save sale' }).click()
  await expect(page.getByText('Sale saved')).toBeVisible()
  await page.goto(CUSTOMERS)
  await page.getByRole('link', { name: /Carla Métodos/ }).first().click()
  await expectPath(page, CUSTOMER)
  await page.getByRole('link', { name: 'Record payment' }).click()
  await page.getByRole('button', { name: /^All:/ }).click()
  await choosePaymentMethod(page, 'Cash')
  await expectToast(page, 'Payment saved', () => page.getByRole('button', { name: 'Save' }).click())

  // Settings → Payments and expenses → Payment methods: three taps from a Tab root.
  await page.goto(HOME)
  const counter: Counter = { taps: 0 }
  await tap(counter, page.getByRole('link', { name: /^Settings for / }))
  await tap(counter, page.getByRole('link', { name: /^Payments and expenses/ }))
  await tap(counter, page.getByRole('link', { name: /^Payment methods/ }))
  await expectPath(page, SETTINGS_PAYMENT_METHODS)
  expect(counter.taps).toBeLessThanOrEqual(TAP_BUDGET_TO_THE_LIST)

  // The opening defaults are offered; Cash is in use, so it can be archived and not deleted.
  await expect(page.getByRole('button', { name: 'Edit Cash' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit Transfer' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Archive Cash' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete Cash' })).toHaveCount(0)

  // Add one with an icon.
  await page.getByRole('button', { name: 'Add method' }).click()
  await page.getByRole('textbox', { name: 'Name' }).fill('Mercado Pago')
  await page.getByRole('radio', { name: 'Phone' }).click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit Mercado Pago' })).toBeVisible()

  // Edit it, then reopen: the Sheet shows what was saved, never the defaults.
  await page.getByRole('button', { name: 'Edit Mercado Pago' }).click()
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Mercado Pago')
  await expect(page.getByRole('radio', { name: 'Phone' })).toBeChecked()
  await page.getByRole('textbox', { name: 'Name' }).fill('Billetera')
  await page.getByRole('radio', { name: 'Wallet' }).click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit Billetera' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit Billetera' }).click()
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Billetera')
  await expect(page.getByRole('radio', { name: 'Wallet' })).toBeChecked()
  await expect(page.getByRole('radio', { name: 'Phone' })).not.toBeChecked()
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  // Delete the one nobody used, confirmed first.
  await page.getByRole('button', { name: 'Delete Billetera' }).click()
  await expect(page.getByRole('alertdialog', { name: 'Delete Billetera for good?' })).toBeVisible()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit Billetera' })).toHaveCount(0)

  // Archive Cash (in use), confirmed first; it leaves the list and shows in Archived.
  await page.getByRole('button', { name: 'Archive Cash' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.getByRole('button', { name: 'Archive', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit Cash' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Archived' }).click()
  await expect(page.getByRole('button', { name: 'Restore Cash' })).toBeVisible()

  // Restore it: it is offered again.
  await page.getByRole('button', { name: 'Restore Cash' }).click()
  await expect(page.getByRole('button', { name: 'Restore Cash' })).toHaveCount(0)
  await page.goBack()
  await expect(page.getByRole('button', { name: 'Edit Cash' })).toBeVisible()
})
