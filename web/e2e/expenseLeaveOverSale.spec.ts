/**
 * The Expense leave question over phone New sale, in a real phone browser against the real
 * backend (GH-769, part 3). Each exit from the Expense form, with a typed Amount, asks
 * "Discard the expense?": Close, the strip's Back and the system back. "No" keeps the Expense and
 * the sale and the next exit asks again; "Yes" closes only the Expense and the sale is as it
 * was. A real double system back shows one question. An untouched Expense closes at once.
 * Leaving New sale with the sale touched asks "Discard the sale?" once, by a tab and by the
 * browser's Back.
 *
 * What is NOT here, on purpose: leaving New sale with the Expense open and changed. On the phone
 * the Expense is a full-screen Sheet, so no tab can be tapped and the first system back closes
 * the Sheet (asking first). The only way to get there from a spec is a reload or a hand-set
 * history state, which is out of scope; that case stays proven at router level (M23,
 * `NuevaVenta.expenseLeave.test.tsx`). Nor does any case say the sale survives a "Yes" to
 * "Discard the sale?": it does not, and that is expected.
 *
 * The question is an `alertdialog` drawn over the Expense Sheet, which is a `dialog`, so the
 * spec counts `alertdialog`s for "one question at a time" and checks the Expense and the sale
 * only after the question has been answered. Roles, names and text only.
 */

import { VARIETY_NAME_LABEL } from './helpers/labels.js'
import { SALE_NEW, VARIETIES } from '../src/routes.js'
import { expect, test } from './fixtures.js'
import type { Page } from '@playwright/test'
import { expectToast } from './helpers/toast.js'
import { fillSaleLine } from './helpers/sale.js'
import { setPriceDate } from './helpers/priceDate.js'
import { signUpNewBusiness } from './helpers/signup.js'
import { expectPath } from './helpers/url.js'

test.use({ viewport: { width: 390, height: 844 } })

const EXPENSE_Q = 'Discard the expense?'
const SALE_Q = 'Discard the sale?'
const STRIP_BACK = /^Sale in progress, 1 product, .*\. Back$/

/** A new business with one priced Product, on New sale with one line filled: the sale is touched. */
async function touchedSale(page: Page): Promise<void> {
  await signUpNewBusiness(page)
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'New product' }).click()
  await page.getByLabel(VARIETY_NAME_LABEL, { exact: true }).fill('Rosa')
  await expectToast(page, 'Product saved', () => page.getByRole('button', { name: 'Add the product' }).click())
  await page.getByRole('link', { name: /Rosa/ }).click()
  await page.getByRole('link', { name: 'New price' }).click()
  await setPriceDate(page, '2000-01-01')
  await page.getByLabel(/^List price/).fill('500')
  await expectToast(page, 'Price saved', () => page.getByRole('button', { name: 'Save the price' }).click())
  // Through Sales, so the browser's Back from New sale has a screen of the app to go to.
  await page.getByRole('navigation', { name: 'Navigation' }).getByRole('link', { name: 'Sales' }).first().click()
  await page.getByRole('link', { name: 'New sale' }).first().click()
  await expectPath(page, SALE_NEW)
  await fillSaleLine(page, 1, { variety: 'Rosa', grams: '5' })
}

/** The sale's total as New sale's footer draws it: the figure next to the "Sale total" label. */
const total = (page: Page) => page.getByText('Sale total', { exact: true }).locator('xpath=following-sibling::span[1]')

async function expectSaleIntact(page: Page, saleTotal: string): Promise<void> {
  await expect(page.getByRole('button', { name: /^Line 1 product/ })).toContainText('Rosa')
  await expect(page.getByLabel('Line 1 grams', { exact: true })).toHaveValue('5')
  await expect(total(page)).toHaveText(saleTotal)
  await expectPath(page, SALE_NEW)
}

async function openExpense(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Expense', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Add expense' })).toBeVisible()
}

async function typeAmount(page: Page): Promise<void> {
  await page.getByLabel('Amount', { exact: true }).fill('1500')
  await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('1500')
}

/** The Sheet is still open with what was typed: what "No" must leave. */
async function expectExpenseKept(page: Page): Promise<void> {
  await expect(page.getByRole('dialog', { name: 'Add expense' })).toBeVisible()
  await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('1500')
}

async function expectOneQuestion(page: Page, name: string): Promise<void> {
  await expect(page.getByRole('alertdialog')).toHaveCount(1)
  await expect(page.getByRole('alertdialog', { name })).toBeVisible()
}

async function answer(page: Page, name: string): Promise<void> {
  await page.getByRole('alertdialog').getByRole('button', { name }).click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
}

/** Opens the Expense, types the Amount; the `exit` asks, "No" keeps everything, the exit asks again, "Yes" closes only the Expense. */
async function exitAsksAndAnswers(page: Page, exit: () => Promise<unknown>): Promise<void> {
  await openExpense(page)
  await typeAmount(page)
  // The strip carries the total while the Sheet covers the form.
  await expect(page.getByRole('button', { name: STRIP_BACK })).toBeVisible()

  await exit()
  await expectOneQuestion(page, EXPENSE_Q)
  await answer(page, 'No, keep entering')
  await expectExpenseKept(page)

  await exit()
  await expectOneQuestion(page, EXPENSE_Q)
  await answer(page, 'Yes, discard it')
  await expect(page.getByRole('dialog', { name: 'Add expense' })).toHaveCount(0)
}

test('an untouched Expense closes on Close with no question, and the sale is intact', async ({ page }) => {
  await touchedSale(page)
  const saleTotal = (await total(page).textContent()) ?? ''
  await openExpense(page)
  await page.getByRole('dialog', { name: 'Add expense' }).getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog', { name: 'Add expense' })).toHaveCount(0)
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expectSaleIntact(page, saleTotal)
})

test('Close with a typed Amount asks; "No" keeps both, it asks again, "Yes" closes only the Expense', async ({ page }) => {
  await touchedSale(page)
  const saleTotal = (await total(page).textContent()) ?? ''
  await exitAsksAndAnswers(page, () =>
    page.getByRole('dialog', { name: 'Add expense' }).getByRole('button', { name: 'Close' }).click(),
  )
  await expectSaleIntact(page, saleTotal)
})

test("the strip's Back asks; \"No\" keeps both, it asks again, \"Yes\" closes only the Expense", async ({ page }) => {
  await touchedSale(page)
  const saleTotal = (await total(page).textContent()) ?? ''
  await exitAsksAndAnswers(page, () => page.getByRole('button', { name: STRIP_BACK }).click())
  await expectSaleIntact(page, saleTotal)
})

test('the system back asks; "No" keeps both, it asks again, "Yes" closes only the Expense', async ({ page }) => {
  await touchedSale(page)
  const saleTotal = (await total(page).textContent()) ?? ''
  await exitAsksAndAnswers(page, () => page.goBack())
  await expectSaleIntact(page, saleTotal)
})

test('a real double system back shows exactly one question, and "No" keeps both', async ({ page }) => {
  await touchedSale(page)
  const saleTotal = (await total(page).textContent()) ?? ''
  await openExpense(page)
  await typeAmount(page)

  // Two backs with nothing awaited between them: the second arrives while the first is being held.
  await Promise.all([page.goBack(), page.goBack()])
  await expectOneQuestion(page, EXPENSE_Q)
  await answer(page, 'No, keep entering')
  await expectExpenseKept(page)
  await expect(page.getByRole('alertdialog')).toHaveCount(0)

  // Still on New sale with the Sheet over it: close it for real and check the sale is as it was.
  await page.getByRole('dialog', { name: 'Add expense' }).getByRole('button', { name: 'Close' }).click()
  await answer(page, 'Yes, discard it')
  await expectSaleIntact(page, saleTotal)
})

test('leaving New sale by a tab asks "Discard the sale?" once; "No" keeps the sale, "Yes" leaves with no second question', async ({
  page,
}) => {
  await touchedSale(page)
  const saleTotal = (await total(page).textContent()) ?? ''
  await exitAsksAndAnswers(page, () => page.getByRole('button', { name: STRIP_BACK }).click())
  await expectSaleIntact(page, saleTotal)

  const tab = page.getByRole('navigation', { name: 'Navigation' }).getByRole('link', { name: 'Home' }).first()
  await tab.click()
  await expectOneQuestion(page, SALE_Q)
  await answer(page, 'No, keep entering')
  await expectSaleIntact(page, saleTotal)

  await tab.click()
  await expectOneQuestion(page, SALE_Q)
  await page.getByRole('alertdialog').getByRole('button', { name: 'Yes, discard it' }).click()
  await expect(page).not.toHaveURL(new RegExp(`${SALE_NEW}$`))
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
})

test('leaving New sale by the browser\'s Back asks "Discard the sale?" once; "No" keeps the sale, "Yes" leaves with no second question', async ({
  page,
}) => {
  await touchedSale(page)
  const saleTotal = (await total(page).textContent()) ?? ''
  await exitAsksAndAnswers(page, () => page.goBack())
  await expectSaleIntact(page, saleTotal)

  await page.goBack()
  await expectOneQuestion(page, SALE_Q)
  await answer(page, 'No, keep entering')
  await expectSaleIntact(page, saleTotal)

  await page.goBack()
  await expectOneQuestion(page, SALE_Q)
  await page.getByRole('alertdialog').getByRole('button', { name: 'Yes, discard it' }).click()
  await expect(page).not.toHaveURL(new RegExp(`${SALE_NEW}$`))
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
})
