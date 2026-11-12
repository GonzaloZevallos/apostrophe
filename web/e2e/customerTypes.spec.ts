/**
 * Customer types end to end, from a phone: a seller turns "Customer types" on in Settings →
 * Prices, creates a type in Settings → Prices → Customer types, then assigns it from the
 * Customer form. The tap budget (customers.md): Prices stays two taps from a Tab root and the
 * list is the third. A tap is a click this spec makes through `tap()`. Roles, names and text only.
 *
 * The Customer form's "Customer type" select comes from the `front-customer` subtask: this spec
 * needs both to be merged, and is the integration's check of the two together.
 */

import type { Locator } from '@playwright/test'
import { CUSTOMER, CUSTOMER_NEW, SETTINGS_CUSTOMER_TYPES, SETTINGS_PRICES } from '../src/routes.js'
import { expect, test } from './fixtures.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { expectPath } from './helpers/url.js'

test.use({ viewport: { width: 390, height: 844 } })

const TAP_BUDGET_TO_PRICES = 2
const TAP_BUDGET_TO_THE_LIST = 3

interface Counter {
  taps: number
}

async function tap(counter: Counter, target: Locator): Promise<void> {
  counter.taps += 1
  await target.click()
}

test('a seller creates a customer type in Settings and assigns it from the Customer form', async ({ page }) => {
  await signUpNewBusiness(page)
  const counter: Counter = { taps: 0 }

  await tap(counter, page.getByRole('link', { name: /^Settings for / }).or(page.getByRole('link', { name: 'Settings', exact: true })))
  await tap(counter, page.getByRole('link', { name: /^Prices/ }))
  await expectPath(page, SETTINGS_PRICES)
  expect(counter.taps).toBeLessThanOrEqual(TAP_BUDGET_TO_PRICES)

  // The switch is off on a new Business: the help line shows, the entry row does not.
  await expect(page.getByText('Customer types have no price yet.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Customer types' })).toHaveCount(0)
  await page.getByRole('switch', { name: 'Customer types' }).click()
  await page.getByRole('button', { name: 'Save the prices' }).click()

  await tap(counter, page.getByRole('link', { name: 'Customer types' }))
  await expectPath(page, SETTINGS_CUSTOMER_TYPES)
  expect(counter.taps).toBeLessThanOrEqual(TAP_BUDGET_TO_THE_LIST)

  await page.getByRole('button', { name: '+ Customer type' }).click()
  await page.getByRole('textbox', { name: 'Name' }).fill('Friends')
  await page.getByRole('radio', { name: 'Heart' }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Friends')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Rename Friends' })).toBeVisible()

  await page.goto(CUSTOMER_NEW)
  await page.getByLabel('Name').fill('Carla Cobrar')
  await page.getByRole('button', { name: /^Customer type/ }).click()
  await page.getByRole('option', { name: 'Friends' }).or(page.getByRole('button', { name: 'Friends', exact: true })).click()
  await page.getByRole('button', { name: 'Save and use' }).click()

  await expectPath(page, CUSTOMER)
  await expect(page.getByText('Friends')).toBeVisible()
})

test('a seller cannot delete a type that still has a customer, and is told how many', async ({ page }) => {
  await signUpNewBusiness(page)
  await page.goto(SETTINGS_PRICES)
  await page.getByRole('switch', { name: 'Customer types' }).click()
  await page.getByRole('button', { name: 'Save the prices' }).click()
  await page.getByRole('link', { name: 'Customer types' }).click()
  await page.getByRole('button', { name: '+ Customer type' }).click()
  await page.getByRole('textbox', { name: 'Name' }).fill('Friends')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('button', { name: 'Delete Friends' })).toBeVisible()

  await page.goto(CUSTOMER_NEW)
  await page.getByLabel('Name').fill('Carla Cobrar')
  await page.getByRole('button', { name: /^Customer type/ }).click()
  await page.getByRole('option', { name: 'Friends' }).or(page.getByRole('button', { name: 'Friends', exact: true })).click()
  await page.getByRole('button', { name: 'Save and use' }).click()
  await expectPath(page, CUSTOMER)

  await page.goto(SETTINGS_CUSTOMER_TYPES)
  await page.getByRole('button', { name: 'Delete Friends' }).click()
  await expect(
    page.getByText('1 customer is in this type. Move that customer to another type first.'),
  ).toBeVisible()
})
