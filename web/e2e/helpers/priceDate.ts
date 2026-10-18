/**
 * Sets the price form's "Effective from" the one way a person does: tap the date chip, then
 * fill the date the choice opens. Every e2e spec goes through here, so a change to how the
 * date is chosen is made once. It also pins the Playwright side of the name split: the
 * caption "Effective from" names the date input only while the choice is open, and nothing
 * before the chip is tapped.
 */

import type { Page } from '@playwright/test'
import { expect } from '../fixtures.js'

export async function setPriceDate(page: Page, iso: string): Promise<void> {
  const date = page.getByLabel('Effective from', { exact: true })
  await expect(date).toHaveCount(0)
  await page.locator('.precio-chip').getByRole('button').click()
  await expect(date).toHaveCount(1)
  await expect(page.getByLabel('Effective from')).toHaveCount(1)
  await date.fill(iso)
}
