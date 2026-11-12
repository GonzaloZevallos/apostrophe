/**
 * The Phone country from a phone viewport (customers.md; PRD metric "From the phone"): a seller
 * sets Phone country to Uruguay in Settings → Business, adds a Customer by typing only the
 * local number, and sees it in international form, against the real backend. The field's
 * example follows the chosen country, and nothing personal reaches the console.
 */

import { CUSTOMER, CUSTOMER_NEW, SETTINGS_BUSINESS } from '../src/routes.js'
import { expectPath } from './helpers/url.js'
import { expect, test } from './fixtures.js'
import { expectToast } from './helpers/toast.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { watchConsole } from './console.js'
import { uniqueTag } from './helpers/unique.js'

test.use({ viewport: { width: 390, height: 844 } })

test('a seller sets Uruguay as the Phone country, types a local number and sees it in international form', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)

  await signUpNewBusiness(page, {
    businessName: `Flores del Plata ${uniqueTag()}`,
    email: `duena-pais-${uniqueTag()}@example.com`,
  })

  await page.goto(SETTINGS_BUSINESS)
  await expect(page.getByRole('radio', { name: 'No country' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('radio', { name: 'Uruguay (+598)' }).click()
  await expectToast(page, 'Saved', () => page.getByRole('button', { name: 'Save' }).click())
  await expect(page.getByRole('radio', { name: 'Uruguay (+598)' })).toHaveAttribute('aria-checked', 'true')

  await page.goto(CUSTOMER_NEW)
  await page.getByLabel('Name').fill('Noe Montevideo')
  const phone = page.getByLabel('Phone')
  await expect(phone).toHaveAttribute('placeholder', '099 123 456')
  await phone.fill('099 123 456')
  await expectToast(page, 'Customer saved', () => page.getByRole('button', { name: 'Save and use' }).click())

  await expectPath(page, CUSTOMER)
  await expect(page.getByText(/\+598/)).toBeVisible()
  expect(consoleMessages).toEqual([])
})
