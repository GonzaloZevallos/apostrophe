/**
 * Settings → Business → Payment methods on a phone (GH-318): a seller adds a method, renames
 * it, changes its icon, moves it up and down, archives a method a payment uses, restores it
 * from Archived and deletes a method nobody used. Roles, names, text and URLs only.
 */

import { CUSTOMER, SETTINGS_PAYMENT_METHODS } from '../src/routes.js'
import { expect, test } from './fixtures.js'
import { seedLedger } from './helpers/ledger.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { expectPath } from './helpers/url.js'
import { uniqueTag } from './helpers/unique.js'

test.use({ viewport: { width: 390, height: 844 } })

const PHONE_TARGET = 44

test('a seller manages the payment methods from the phone', async ({ page }) => {
  await signUpNewBusiness(page)

  // A payment on Cash makes Cash a method "in use": it can be archived, not deleted.
  const customerName = `Nico ${uniqueTag()}`
  await seedLedger(page, customerName, 1)
  await expectPath(page, CUSTOMER)
  const customerId = /\/(\d+)$/.exec(new URL(page.url()).pathname)?.[1]
  if (customerId === undefined) throw new Error(`no customer id in ${page.url()}`)
  const me = (await (await page.request.get('/auth/me')).json()) as { today: string }
  const methods = (await (await page.request.get('/api/payment-methods')).json()) as { id: number; name: string }[]
  const cash = methods.find((method) => method.name === 'Cash')
  if (cash === undefined) throw new Error('a new business has no Cash')
  const paid = await page.request.post(`/customers/${customerId}/payments`, {
    data: { paid_on: me.today, amount: 100, payment_method_id: cash.id },
  })
  expect(paid.status()).toBe(201)

  await page.goto(SETTINGS_PAYMENT_METHODS)
  const rows = page.getByRole('button', { name: /^Edit / })
  await expect(rows).toHaveText(['Cash', 'Transfer'])
  await expect(page.getByRole('button', { name: 'Move Cash up' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Move Transfer down' })).toHaveCount(0)

  // Add.
  await page.getByRole('button', { name: '+ Add method' }).click()
  const sheet = page.getByRole('dialog')
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveAttribute('autocomplete', 'off')
  await page.getByRole('textbox', { name: 'Name' }).fill('Card')
  await page.getByRole('radio', { name: /Card/ }).click()
  await expect(page.getByRole('radio', { name: /Card.*Selected/ })).toBeVisible()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toHaveCount(0)
  await expect(rows).toHaveText(['Cash', 'Transfer', 'Card'])

  // Rename, then change the icon.
  await page.getByRole('button', { name: 'Edit Card' }).click()
  await page.getByRole('textbox', { name: 'Name' }).fill('Cards')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(rows).toHaveText(['Cash', 'Transfer', 'Cards'])
  await page.getByRole('button', { name: 'Edit Cards' }).click()
  await page.getByRole('radio', { name: /Wallet/ }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('button', { name: 'Edit Cards' }).click()
  await expect(page.getByRole('radio', { name: /Wallet/ })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('button', { name: 'Close' }).click()

  // Move up, then down; the targets are phone-sized.
  const moveUp = page.getByRole('button', { name: 'Move Cards up' })
  const box = await moveUp.boundingBox()
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(PHONE_TARGET)
  await moveUp.click()
  await expect(rows).toHaveText(['Cash', 'Cards', 'Transfer'])
  await page.getByRole('button', { name: 'Move Cards down' }).click()
  await expect(rows).toHaveText(['Cash', 'Transfer', 'Cards'])

  // A used method is archived (no confirmation) and comes back from Archived.
  await page.getByRole('button', { name: 'Edit Cash' }).click()
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Archive' }).click()
  await expect(rows).toHaveText(['Transfer', 'Cards'])
  await page.getByRole('link', { name: /Archived/ }).click()
  await expect(page.getByRole('heading', { name: 'Archived methods' })).toBeVisible()
  await expect(page.getByText('Cash')).toBeVisible()
  await page.getByRole('button', { name: 'Restore Cash' }).click()
  await expect(page.getByText('No archived methods')).toBeVisible()
  await page.goto(SETTINGS_PAYMENT_METHODS)
  await expect(rows).toHaveText(['Cash', 'Transfer', 'Cards'])

  // An unused method is deleted after a confirmation.
  await page.getByRole('button', { name: 'Edit Cards' }).click()
  await expect(page.getByRole('button', { name: 'Archive' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Yes, delete it' }).click()
  await expect(rows).toHaveText(['Cash', 'Transfer'])
})
