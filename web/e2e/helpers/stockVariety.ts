/**
 * Picks an option of a Selector field (the Stock entry's Variety, Take from stock's Reason and
 * line Varieties): open the field, then take the row by its name. A phone draws the rows as
 * buttons in a sheet, a computer as options in a dropdown, so the row is looked for in both.
 */

import type { Page } from '@playwright/test'
import { expect } from '../fixtures.js'

export async function pickSelectorOption(page: Page, label: string, option: string): Promise<void> {
  const field = page.getByRole('group', { name: label, exact: true }).getByRole('button')
  await field.click()
  const row = page
    .getByRole('option', { name: option, exact: true })
    .or(page.getByRole('dialog', { name: `${label} options` }).getByRole('button', { name: option, exact: true }))
  await row.click()
  await expect(field).toContainText(option)
}

export async function pickStockVariety(page: Page, variety: string): Promise<void> {
  await pickSelectorOption(page, 'Product', variety)
}

/** The first line's Variety and the Reason of the Take from stock form. */
export async function pickWithdrawalVariety(page: Page, variety: string): Promise<void> {
  await pickSelectorOption(page, 'Product', variety)
}

export async function pickWithdrawalReason(page: Page, reason: string): Promise<void> {
  await pickSelectorOption(page, 'Reason', reason)
}
