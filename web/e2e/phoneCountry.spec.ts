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
import { servedCountry } from './helpers/phoneCountries.js'

const LOCKED_REASON = 'The + and the code set the country'

/** The Selector's field: its accessible name starts with its label, then the shown value. */
const countryField = (page: Page) => page.getByRole('button', { name: /^Phone country/ })
const phoneField = (page: Page) => page.getByLabel('Phone', { exact: true })

/** The open list: a dialog on the phone, whose choices are buttons. */
const countryList = (page: Page) => page.getByRole('dialog', { name: 'Phone country options' })

async function pickCountry(page: Page, option: string): Promise<void> {
  await countryField(page).click()
  await countryList(page).getByRole('button', { name: option, exact: true }).click()
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

  // The listing as the real backend serves it: the spec states no code and no example itself.
  const uruguay = await servedCountry(page, 'UY', 'Uruguay')
  const argentina = await servedCountry(page, 'AR', 'Argentina')
  const chile = await servedCountry(page, 'CL', 'Chile')

  // A local Uruguayan number, with the Selector untouched: detected from the language and the zone.
  await newCustomerForm(page, 'Noe Montevideo')
  await expect(countryField(page)).toContainText(uruguay.label)
  await expect(countryField(page)).not.toHaveAttribute('aria-disabled', 'true')
  await expect(phoneField(page)).toHaveAttribute('placeholder', uruguay.example)
  await phoneField(page).fill(uruguay.example)
  await saveAndUse(page)
  await expect(page.getByText(`+${uruguay.callingCode}`)).toBeVisible()

  // An Argentine customer: the seller picks Argentina and types the local form; the example follows.
  await newCustomerForm(page, 'Carla Buenos Aires')
  await pickCountry(page, argentina.label)
  await expect(phoneField(page)).toHaveAttribute('placeholder', argentina.example)
  await phoneField(page).fill(argentina.example)
  await saveAndUse(page)
  await expect(page.getByText(`+${argentina.callingCode}`)).toBeVisible()

  // A "+" decides the country: the Selector shows it, locked, with its reason; the text is not rewritten.
  await newCustomerForm(page, 'Rosa Santiago')
  const plusChile = `+${chile.callingCode} 9 5555 0177`
  await phoneField(page).fill(plusChile)
  await expect(countryField(page)).toContainText(chile.label)
  await expect(countryField(page)).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByText(LOCKED_REASON)).toBeVisible()
  await expect(phoneField(page)).toHaveValue(plusChile)
  // Locked: neither a tap nor the keys open the list.
  // Playwright holds back a click on an aria-disabled button, so the tap is forced.
  await countryField(page).click({ force: true })
  await countryField(page).press('ArrowDown')
  await expect(countryList(page)).toHaveCount(0)
  await expect(countryField(page)).toHaveAttribute('aria-expanded', 'false')
  // Without the "+" it unlocks and keeps the last shown country.
  await phoneField(page).fill('9 5555 0177')
  await expect(countryField(page)).not.toHaveAttribute('aria-disabled', 'true')
  await expect(countryField(page)).toContainText(chile.label)
  await phoneField(page).fill(plusChile)
  await saveAndUse(page)
  await expect(page.getByText(`+${chile.callingCode}`)).toBeVisible()

  // Each edit opens on its own number's country, locked.
  for (const [name, country] of [
    ['Noe Montevideo', uruguay.label],
    ['Carla Buenos Aires', argentina.label],
    ['Rosa Santiago', chile.label],
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
