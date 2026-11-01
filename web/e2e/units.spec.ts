/**
 * The phone flow of units: create one in Settings → Products → Units, then give it to a new
 * product (the form asks for the unit once the business has two) and see it on the product's
 * own page. Everything goes through the built front; roles, names and text only.
 */

import { SETTINGS_UNITS, VARIETIES } from '../src/routes.js'
import { expect, test } from './fixtures.js'
import { expectToast } from './helpers/toast.js'
import { signUp } from './helpers/seed.js'

test.use({ viewport: { width: 390, height: 844 } })

test('a seller creates a unit on the phone and gives it to a new product from its page', async ({ page }) => {
  await signUp(page, 'units-flow')

  await page.goto(SETTINGS_UNITS)
  await expect(page.getByRole('button', { name: 'Edit unit' })).toBeVisible()
  await page.getByRole('button', { name: '+ New unit' }).click()

  const sheet = page.getByRole('dialog', { name: 'New unit' })
  await expect(sheet).toBeVisible()
  await sheet.getByRole('textbox', { name: /^Name/ }).fill('Kilos')
  await sheet.getByRole('textbox', { name: /^Label/ }).fill('kg')
  await sheet.getByRole('radio', { name: '1', exact: true }).click()
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('button', { name: 'Edit Kilos' })).toBeVisible()

  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'New variety' }).click()
  const form = page.getByRole('dialog', { name: 'New variety' })
  await form.getByRole('textbox', { name: /^Name/ }).fill('Rosa')
  await form.getByRole('combobox', { name: 'Unit' }).selectOption({ label: 'Kilos' })
  await expectToast(page, 'Variety saved', () => page.getByRole('button', { name: 'Add the variety' }).click())

  await page.getByRole('link', { name: /Rosa/ }).click()
  await expect(page.getByRole('combobox', { name: 'Unit' }).locator('option:checked')).toHaveText('Kilos')
})
