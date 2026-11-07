/**
 * Picks the Variety of the Stock entry form, now a Selector: open the field, then take the
 * row by its name. A phone draws the rows as buttons in a sheet, a computer as options in a
 * dropdown, so the row is looked for in both.
 */

import type { Page } from '@playwright/test'
import { expect } from '../fixtures.js'

export async function pickStockVariety(page: Page, variety: string): Promise<void> {
  await page.getByRole('group', { name: 'Variety', exact: true }).getByRole('button').click()
  const row = page
    .getByRole('option', { name: variety, exact: true })
    .or(page.getByRole('dialog', { name: 'Variety options' }).getByRole('button', { name: variety, exact: true }))
  await row.click()
  await expect(page.getByRole('group', { name: 'Variety', exact: true }).getByRole('button')).toContainText(variety)
}
