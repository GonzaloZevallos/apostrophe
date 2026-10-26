/**
 * The stock entry form as a sheet on a phone (ADR-0053): a direct address opens it over its parent
 * (new over Varieties, edit over All entries), focus is in the first field, and the action sits at
 * the bottom of the sheet within the bottom inset. Roles, names, text and URLs only.
 */

import type { Page } from '@playwright/test'
import { STOCK_ENTRY, STOCK_ENTRY_NEW, pathTo } from '../src/routes.js'
import { expect, test } from './fixtures.js'
import { seedRecords, signUp } from './helpers/seed.js'

test.use({ viewport: { width: 390, height: 844 } })

async function expectActionAtTheBottom(page: Page, dialogName: string, action: string): Promise<void> {
  const dialog = page.getByRole('dialog', { name: dialogName })
  const button = dialog.getByRole('button', { name: action })
  await expect(button).toBeInViewport()
  // `.sheet__actions` ends at the sheet's bottom, and its own padding (one spacing step plus
  // `--inset-abajo`) is all that lies between the action and that edge.
  const padding = await page
    .locator('.sheet__actions')
    .evaluate((element) => parseFloat(getComputedStyle(element).paddingBottom))
  const sheet = await page.locator('.sheet').boundingBox()
  const box = await button.boundingBox()
  if (sheet === null || box === null) throw new Error('no box')
  const gap = sheet.y + sheet.height - (box.y + box.height)
  expect(Math.abs(gap - padding)).toBeLessThanOrEqual(1)
}

test('a direct address to the new entry opens the sheet over Varieties, focus in Date', async ({ page }) => {
  await signUp(page, 'sheet-new')
  await seedRecords(page, 'Carla Cobrar')
  await page.goto(STOCK_ENTRY_NEW)

  const dialog = page.getByRole('dialog', { name: 'New entry' })
  await expect(dialog).toBeVisible()
  await expect(page.getByLabel('Date')).toBeFocused()
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeVisible()
  await expect(page.locator('.behind-pane')).toHaveAttribute('inert', '')
  await expectActionAtTheBottom(page, 'New entry', 'Save the entry')
})

test('a direct address to Edit entry opens the sheet over All entries, Delete above Save', async ({ page }) => {
  await signUp(page, 'sheet-edit')
  const records = await seedRecords(page, 'Carla Cobrar')
  await page.goto(pathTo(STOCK_ENTRY, { id: records.entry }))

  const dialog = page.getByRole('dialog', { name: 'Edit entry' })
  await expect(dialog).toBeVisible()
  await expect(page.getByLabel('Date')).toBeFocused()
  await expect(page.locator('.behind-pane')).toHaveAttribute('inert', '')
  const del = await dialog.getByRole('button', { name: 'Delete entry' }).boundingBox()
  const save = await dialog.getByRole('button', { name: 'Save' }).boundingBox()
  if (del === null || save === null) throw new Error('no box')
  expect(del.y + del.height).toBeLessThanOrEqual(save.y)
  await expectActionAtTheBottom(page, 'Edit entry', 'Save')
})
