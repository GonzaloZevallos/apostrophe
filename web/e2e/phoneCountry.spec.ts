/**
 * The Phone country per number, from a phone viewport on a Uruguayan device (customers.md; ADR-0085):
 * the country of a number is chosen in the customer form and its default is detected from where the
 * app is used, against the real backend and the real built front.
 *
 * The device is the `phone-country-uy` project of `playwright.config.ts` (`es-UY`,
 * `America/Montevideo`, 390x844): a spec never sets its own locale or zone (ADR-0040), so no
 * `test.use` here.
 */

import type { Page } from '@playwright/test'
import { CUSTOMER, CUSTOMERS, CUSTOMER_NEW, SETTINGS_BUSINESS } from '../src/routes.js'
import { expectPath } from './helpers/url.js'
import { expect, test } from './fixtures.js'
import { expectToast } from './helpers/toast.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { watchConsole } from './console.js'
import { uniqueTag } from './helpers/unique.js'

const LOCKED_REASON = 'The + and the code set the country'

/** The Selector's field: its accessible name starts with its label, then the shown value. */
const countryField = (page: Page) => page.getByRole('button', { name: /^Phone country/ })
const phoneField = (page: Page) => page.getByLabel('Phone', { exact: true })

async function pickCountry(page: Page, option: string): Promise<void> {
  await countryField(page).click()
  await page.getByRole('option', { name: option }).click()
  await expect(countryField(page)).toContainText(option)
}

async function newCustomerForm(page: Page, name: string): Promise<void> {
  await page.goto(CUSTOMER_NEW)
  await page.getByLabel('Name').fill(name)
  // The list resolved and detection ran: the Selector no longer loads.
  await expect(countryField(page)).not.toHaveAttribute('aria-busy', 'true')
}

async function saveAndUse(page: Page): Promise<void> {
  await expectToast(page, 'Customer saved', () => page.getByRole('button', { name: 'Save and use' }).click())
  await expectPath(page, CUSTOMER)
}

test('a Uruguayan device saves a local Uruguayan number, an Argentine one by picking, a "+" locks, each edit shows its country and Settings has no Phone country', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)

  await signUpNewBusiness(page, {
    businessName: `Flores del Plata ${uniqueTag()}`,
    email: `duena-pais-${uniqueTag()}@example.com`,
  })

  // A local Uruguayan number, with the Selector untouched: detected from the language and the zone.
  await newCustomerForm(page, 'Noe Montevideo')
  await expect(countryField(page)).toContainText('Uruguay (+598)')
  await expect(countryField(page)).not.toHaveAttribute('aria-disabled', 'true')
  await expect(phoneField(page)).toHaveAttribute('placeholder', '099 123 456')
  await phoneField(page).fill('099 123 456')
  await saveAndUse(page)
  await expect(page.getByText(/\+598/)).toBeVisible()

  // An Argentine customer: the seller picks Argentina and types the local form; the example follows.
  await newCustomerForm(page, 'Carla Buenos Aires')
  await pickCountry(page, 'Argentina (+54)')
  await expect(phoneField(page)).not.toHaveAttribute('placeholder', '099 123 456')
  await phoneField(page).fill('11 5555 0188')
  await saveAndUse(page)
  await expect(page.getByText(/\+54/)).toBeVisible()

  // A "+" decides the country: the Selector shows it, locked, with its reason; the text is not rewritten.
  await newCustomerForm(page, 'Rosa Santiago')
  await phoneField(page).fill('+56 9 5555 0177')
  await expect(countryField(page)).toContainText('Chile (+56)')
  await expect(countryField(page)).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByText(LOCKED_REASON)).toBeVisible()
  await expect(phoneField(page)).toHaveValue('+56 9 5555 0177')
  await countryField(page).click()
  await expect(page.getByRole('option', { name: 'Argentina (+54)' })).toHaveCount(0)
  // Without the "+" it unlocks and keeps the last shown country.
  await phoneField(page).fill('9 5555 0177')
  await expect(countryField(page)).not.toHaveAttribute('aria-disabled', 'true')
  await expect(countryField(page)).toContainText('Chile (+56)')
  await phoneField(page).fill('+56 9 5555 0177')
  await saveAndUse(page)
  await expect(page.getByText(/\+56/)).toBeVisible()

  // Each edit opens on its own number's country, locked.
  for (const [name, country] of [
    ['Noe Montevideo', 'Uruguay (+598)'],
    ['Carla Buenos Aires', 'Argentina (+54)'],
    ['Rosa Santiago', 'Chile (+56)'],
  ] as const) {
    await page.goto(CUSTOMERS)
    await page.getByRole('link', { name: new RegExp(name) }).first().click()
    await page.getByRole('link', { name: 'Edit' }).click()
    await expect(countryField(page)).toContainText(country)
    await expect(countryField(page)).toHaveAttribute('aria-disabled', 'true')
    await expect(page.getByText(LOCKED_REASON)).toBeVisible()
  }

  // The Business group of Settings no longer holds a Phone country.
  await page.goto(SETTINGS_BUSINESS)
  await expect(page.getByLabel('Business name')).toBeVisible()
  await expect(page.getByText('Phone country')).toHaveCount(0)
  await expect(page.getByRole('radio', { name: 'No country' })).toHaveCount(0)

  expect(consoleMessages).toEqual([])
})
