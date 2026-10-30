/**
 * The browser's own Back on a dirty form asks the same question "Close" does, at the
 * phone viewport, against the real backend: a dirty Record payment asks "Discard the
 * payment?" and a dirty New sale asks "Discard the sale?". "No, keep entering" keeps
 * what was typed.
 */

import { CUSTOMER, CUSTOMER_NEW, CUSTOMERS, SALE_NEW, VARIETIES } from '../src/routes.js'
import { expectPath } from './helpers/url.js'
import { expect, test } from './fixtures.js'
import { expectToast } from './helpers/toast.js'
import { newBusinessInvitationUrl } from './backend.js'
import { fillSaleLine } from './helpers/sale.js'
import { leaveOnboarding } from './helpers/signup.js'
import { uniqueTag } from './helpers/unique.js'

const PASSWORD = 'correcthorsebattery'

test.use({ viewport: { width: 390, height: 844 } })

test('Back on a dirty Record payment and on a dirty New sale asks, and "No" keeps what was typed', async ({
  page,
}) => {
  await page.goto(newBusinessInvitationUrl())
  await page.getByLabel('Business name').fill(`Flores del Norte ${uniqueTag()}`)
  await page.getByLabel('Email address').fill(`duena-volver-${uniqueTag()}@example.com`)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create the business' }).click()
  // A new business lands in the Onboarding; this spec is about something else.
  await leaveOnboarding(page)

  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'New variety' }).click()
  await page.getByLabel('Name').fill('Rosa')
  await expectToast(page, 'Variety saved', () => page.getByRole('button', { name: 'Add the variety' }).click())
  await page.getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('link', { name: 'New price' }).click()
  await page.getByLabel(/^List price/).fill('1000')
  await expectToast(page, 'Price saved', () => page.getByRole('button', { name: 'Save the price' }).click())

  await page.goto(CUSTOMER_NEW)
  await page.getByLabel('Name').fill('Carla Volver')
  await page.getByRole('button', { name: 'Save and use' }).click()
  await expectPath(page, CUSTOMER)
  await page.getByRole('link', { name: 'New sale to Carla Volver' }).click()
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '5' })
  await page.getByRole('radio', { name: 'Owing' }).check()
  await page.getByRole('button', { name: 'Save sale' }).click()
  await expect(page.getByText('Sale saved')).toBeVisible()

  // A dirty Record payment, reached from Customers' "Collect from".
  await page.goto(CUSTOMERS)
  await page.getByRole('link', { name: 'Collect from Carla Volver' }).first().click()
  await page.getByRole('radio', { name: 'Cash' }).check()
  // Back only once the form has taken the choice: a Back sent before it counts the form clean leaves unasked.
  await expect(page.getByRole('radio', { name: 'Cash' })).toBeChecked()
  await page.goBack()
  await expect(page.getByText('Discard the payment?')).toBeVisible()
  await page.getByRole('button', { name: 'No, keep entering' }).click()
  await expect(page.getByRole('radio', { name: 'Cash' })).toBeChecked()
  await page.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: 'Yes, discard it' }).click()
  await expectPath(page, CUSTOMERS)

  // A dirty New sale.
  await page.goto(CUSTOMERS)
  await page.getByRole('link', { name: 'Carla Volver' }).first().click()
  await page.getByRole('link', { name: 'New sale to Carla Volver' }).click()
  await expectPath(page, SALE_NEW)
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '3' })
  await page.goBack()
  await expect(page.getByText('Discard the sale?')).toBeVisible()
  await page.getByRole('button', { name: 'No, keep entering' }).click()
  await expectPath(page, SALE_NEW)
  await expect(page.getByLabel('Line 1 grams')).toHaveValue('3')
})
