/**
 * The expense form as a sheet on a phone (ADR-0062): a direct address to the new-expense form
 * opens it over Expenses, editing an expense in Expenses opens an in-page sheet, focus is in the
 * first field, and the action sits at the bottom of the sheet within the bottom inset. Roles,
 * names, text and URLs only.
 */

import type { Page } from '@playwright/test'
import { EXPENSE_NEW, EXPENSES } from '../src/routes.js'
import { expect, test } from './fixtures.js'
import { signUpNewBusiness } from './helpers/signup.js'

test.use({ viewport: { width: 390, height: 844 } })

/** Records "Bolsas" under the business's first category, dated on the business's own today. */
async function recordBolsas(page: Page): Promise<void> {
  const me = (await (await page.request.get('/auth/me')).json()) as { today: string }
  // A new business starts with its categories; the form lists them, so any one will do.
  const categories = (await (await page.request.get('/expense-categories')).json()) as { id: number }[]
  const id = categories[0]?.id
  if (id === undefined) throw new Error('a new business has no expense category')
  const recorded = await page.request.post('/expenses', {
    data: { spent_on: me.today, category_id: id, amount: 4500, detail: 'Bolsas' },
  })
  expect(recorded.status()).toBe(201)
}

async function expectActionAtTheBottom(page: Page, dialogName: string): Promise<void> {
  const dialog = page.getByRole('dialog', { name: dialogName })
  const save = dialog.getByRole('button', { name: 'Save the expense' })
  await expect(save).toBeInViewport()
  // `.sheet__actions` ends at the sheet's bottom, and its own padding (one spacing step plus
  // `--inset-abajo`) is all that lies between the action and that edge.
  const padding = await page
    .locator('.sheet__actions')
    .evaluate((element) => parseFloat(getComputedStyle(element).paddingBottom))
  const sheet = await page.locator('.sheet').boundingBox()
  const action = await save.boundingBox()
  if (sheet === null || action === null) throw new Error('no box')
  const gap = sheet.y + sheet.height - (action.y + action.height)
  expect(Math.abs(gap - padding)).toBeLessThanOrEqual(1)
}

test('a direct address to Add expense opens the sheet over Expenses, focus in Date', async ({ page }) => {
  await signUpNewBusiness(page)
  await recordBolsas(page)
  await page.goto(EXPENSE_NEW)

  const dialog = page.getByRole('dialog', { name: 'Add expense' })
  await expect(dialog).toBeVisible()
  await expect(page.getByLabel('Date')).toBeFocused()
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeVisible()
  await expect(page.locator('.behind-pane')).toHaveAttribute('inert', '')
  await expect(page.locator('.behind-pane')).toContainText('Bolsas')
  await expectActionAtTheBottom(page, 'Add expense')
})

test('editing an expense opens an in-page sheet, focus in Date, Delete above Save', async ({ page }) => {
  await signUpNewBusiness(page)
  await recordBolsas(page)
  await page.goto(EXPENSES)

  await page.getByRole('button', { name: /Bolsas/ }).click()

  const dialog = page.getByRole('dialog', { name: 'Edit expense' })
  await expect(dialog).toBeVisible()
  await expect(page.getByLabel('Date')).toBeFocused()
  await expect(page.locator('.behind-pane')).toHaveCount(0)
  const del = dialog.getByRole('button', { name: 'Delete expense' })
  const save = dialog.getByRole('button', { name: 'Save the expense' })
  const deleteBox = await del.boundingBox()
  const saveBox = await save.boundingBox()
  if (deleteBox === null || saveBox === null) throw new Error('no box')
  expect(deleteBox.y + deleteBox.height).toBeLessThanOrEqual(saveBox.y)
  await expectActionAtTheBottom(page, 'Edit expense')
})
