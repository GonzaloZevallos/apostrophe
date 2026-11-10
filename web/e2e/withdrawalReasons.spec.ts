/**
 * Withdrawal reasons end to end, from a phone (GH-318 M2): a seller adds a reason in
 * Settings → Business → Withdrawal reasons, "Take from stock" offers it last with nothing
 * preselected, she records a withdrawal with it, and Inicio's Semana shows that reason's
 * cost line. Through the built front alone, against the real backend.
 *
 * Rosa's only lot is 50 g for $ 20.000 ($ 400 the gram), so a 3 g withdrawal costs $ 1.200.
 */

import { expect, test } from './fixtures.js'
import { expectToast } from './helpers/toast.js'
import { pickStockVariety, pickWithdrawalReason, pickWithdrawalVariety } from './helpers/stockVariety.js'
import { HOME, VARIETIES } from '../src/routes.js'
import { watchConsole } from './console.js'
import { openTakeFromStock } from './helpers/openScreens.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { uniqueTag } from './helpers/unique.js'

test.use({ viewport: { width: 390, height: 844 } })

test('a seller adds a withdrawal reason, records a withdrawal with it and reads it on Inicio', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)

  const businessName = `Flores de Motivos ${uniqueTag()}`
  await signUpNewBusiness(page, { businessName, email: `duena-motivos-${uniqueTag()}@example.com` })
  await expect(page.locator('.encabezado__negocio')).toHaveText(businessName)

  // A variety with one lot: 50 g for $ 20.000.
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'New product' }).click()
  await page.getByLabel('Name').fill('Rosa')
  await expectToast(page, 'Product saved', () => page.getByRole('button', { name: 'Add the product' }).click())
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: '+ Stock entry' }).click()
  await page.getByLabel('Grams').fill('50')
  await pickStockVariety(page, 'Rosa')
  await page.getByLabel('Total cost').fill('20000')
  await expectToast(page, 'Entry saved', () => page.getByRole('button', { name: 'Save the entry' }).click())

  // Settings → Business → Withdrawal reasons: add "Gifts".
  await page.goto(HOME)
  await page.getByRole('link', { name: /^Settings for / }).click()
  await page.getByRole('link', { name: 'Business', exact: true }).click()
  await page.getByRole('link', { name: 'Withdrawal reasons', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Add reason' })).toBeVisible()
  await page.getByRole('button', { name: 'Add reason' }).click()
  await page.getByLabel('Name', { exact: true }).fill('Gifts')
  // The reasons screen's toast is an Aviso, which the e2e toast recorder does not watch; read it on the page.
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Reason saved')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Move Gifts up' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Move Gifts down' })).toHaveCount(0)

  // "Take from stock" offers it last, and no reason is preselected.
  await openTakeFromStock(page)
  const reasonField = page.getByRole('group', { name: 'Reason', exact: true }).getByRole('button')
  await expect(reasonField).not.toContainText('Gifts')
  await reasonField.click()
  const reasonRows = page
    .getByRole('option')
    .or(page.getByRole('dialog', { name: 'Reason options' }).getByRole('button'))
  await expect(reasonRows.last()).toHaveText('Gifts')
  await page.keyboard.press('Escape')

  // Record 3 g with it.
  await pickWithdrawalVariety(page, 'Rosa')
  await page.getByLabel('Grams 1', { exact: true }).fill('3')
  await expect(page.getByRole('button', { name: 'Save the withdrawal' })).toBeDisabled()
  await pickWithdrawalReason(page, 'Gifts')
  await expectToast(page, 'Withdrawal saved', () => page.getByRole('button', { name: 'Save the withdrawal' }).click())

  // Inicio's Semana shows the reason's cost line, at lot cost.
  await page.goto(HOME)
  await page.getByRole('button', { name: 'Week', exact: true }).click()
  await expect(page.getByText('You sold this week')).toBeVisible()
  await expect(page.getByRole('group', { name: 'Gifts', exact: true })).toContainText('$ 1.200')

  expect(consoleMessages).toEqual([])
})
