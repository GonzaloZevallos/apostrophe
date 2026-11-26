/**
 * Customer types end to end, from a phone: a seller turns "Customer types" on in Settings →
 * Prices, creates a type in Settings → Customer types, then assigns it from the
 * Customer form. The tap budget (customers.md): Prices stays two taps from a Tab root; on a new
 * Business the list is the fourth tap (Close Prices, then the Settings row), and creating a type
 * takes seven; with the switch already on the list is two taps from a Tab root. Switching on and
 * saving are not counted. A tap is a click this spec makes through `tap()`. Roles, names and text only.
 *
 * The Customer form's "Customer type" select comes from the `front-customer` subtask: this spec
 * needs both to be merged, and is the integration's check of the two together.
 */

import type { Locator, Page } from '@playwright/test'
import { CUSTOMER, CUSTOMER_NEW, HOME, SETTINGS, SETTINGS_CUSTOMER_TYPES, SETTINGS_PRICES } from '../src/routes.js'
import { expect, test } from './fixtures.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { settingsEntry } from './helpers/chrome.js'
import { settingsShortcut } from './helpers/settingsHome.js'
import { expectPath } from './helpers/url.js'

test.use({ viewport: { width: 390, height: 844 } })

const TAP_BUDGET_TO_PRICES = 2
const TAP_BUDGET_TO_THE_LIST = 4
const TAP_BUDGET_TO_CREATE = 7
const TAP_BUDGET_REPEAT_TO_THE_LIST = 2

interface Counter {
  taps: number
}

/** The Settings row that opens the list: a link whose name starts with its label (it shows only with the saved switch on). */
function customerTypesRow(page: Page): Locator {
  return page.getByRole('link', { name: /^Customer types\b/ })
}

async function tap(counter: Counter, target: Locator): Promise<void> {
  counter.taps += 1
  await target.click()
}

test('a seller creates a customer type in Settings and assigns it from the Customer form', async ({ page }) => {
  await signUpNewBusiness(page)
  const counter: Counter = { taps: 0 }

  await tap(counter, settingsEntry(page))
  await tap(counter, settingsShortcut(page, 'Prices'))
  await expectPath(page, SETTINGS_PRICES)
  expect(counter.taps).toBeLessThanOrEqual(TAP_BUDGET_TO_PRICES)

  // The switch is off on a new Business: the help line shows, the entry row does not.
  await expect(page.getByText('Customer types have no price yet.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Customer types' })).toHaveCount(0)
  await page.getByRole('switch', { name: 'Customer types' }).click()
  await page.getByRole('button', { name: 'Save the prices' }).click()

  // Prices has no link to the list: it opens from its own Settings row.
  await expect(page.getByRole('link', { name: 'Customer types' })).toHaveCount(0)
  await tap(counter, page.getByRole('button', { name: 'Close' }))
  await expectPath(page, SETTINGS)
  await tap(counter, customerTypesRow(page))
  await expectPath(page, SETTINGS_CUSTOMER_TYPES)
  expect(counter.taps).toBeLessThanOrEqual(TAP_BUDGET_TO_THE_LIST)

  await tap(counter, page.getByRole('button', { name: '+ Customer type' }))
  await page.getByRole('textbox', { name: 'Name' }).fill('Friends')
  await tap(counter, page.getByRole('radio', { name: 'Heart' }))
  await tap(counter, page.getByRole('button', { name: 'Save' }))
  expect(counter.taps).toBeLessThanOrEqual(TAP_BUDGET_TO_CREATE)
  await expect(page.getByText('Friends')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Rename Friends' })).toBeVisible()

  await page.goto(CUSTOMER_NEW)
  await page.getByLabel('Name', { exact: true }).fill('Carla Cobrar')
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
  await page.getByRole('button', { name: 'Close' }).click()
  await customerTypesRow(page).click()
  await page.getByRole('button', { name: '+ Customer type' }).click()
  await page.getByRole('textbox', { name: 'Name' }).fill('Friends')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('button', { name: 'Delete Friends' })).toBeVisible()

  await page.goto(CUSTOMER_NEW)
  await page.getByLabel('Name', { exact: true }).fill('Carla Cobrar')
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

test('with the switch already on, the list is two taps from a Tab root', async ({ page }) => {
  await signUpNewBusiness(page)
  await page.goto(SETTINGS_PRICES)
  await page.getByRole('switch', { name: 'Customer types' }).click()
  await page.getByRole('button', { name: 'Save the prices' }).click()
  await expect(page.getByText('Prices saved')).toBeVisible()
  await page.goto(HOME)
  const counter: Counter = { taps: 0 }

  await tap(counter, settingsEntry(page))
  await tap(counter, customerTypesRow(page))

  await expectPath(page, SETTINGS_CUSTOMER_TYPES)
  expect(counter.taps).toBeLessThanOrEqual(TAP_BUDGET_REPEAT_TO_THE_LIST)
})
