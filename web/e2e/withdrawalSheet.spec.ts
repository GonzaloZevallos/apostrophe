/**
 * The withdrawal form as a sheet on a phone (ADR-0062): a direct address opens it over its parent
 * (new over Varieties, edit over the withdrawal's detail), focus is in the first control, and the
 * action sits at the bottom of the sheet within the bottom inset, on the tallest form too (a
 * withdrawal with several lines). Roles, names, text and URLs only.
 */

import type { Page } from '@playwright/test'
import { WITHDRAWAL_EDIT, WITHDRAWAL_NEW, pathTo } from '../src/routes.js'
import { expect, test } from './fixtures.js'
import { seedRecords, signUp } from './helpers/seed.js'

test.use({ viewport: { width: 390, height: 844 } })

async function expectActionAtTheBottom(page: Page, action: string): Promise<void> {
  const dialog = page.getByRole('dialog', { name: 'Take from stock' })
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

test('a direct address to the new withdrawal opens the sheet over Varieties, focus on the first reason', async ({
  page,
}) => {
  await signUp(page, 'withdrawal-new')
  await seedRecords(page, 'Carla Cobrar')
  await page.goto(WITHDRAWAL_NEW)

  const dialog = page.getByRole('dialog', { name: 'Take from stock' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Promotion', exact: true })).toBeFocused()
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeVisible()
  await expect(page.locator('.behind-pane')).toHaveAttribute('inert', '')
  await expectActionAtTheBottom(page, 'Save the withdrawal')
})

test('a direct address to the edit opens the sheet over the withdrawal, on the tallest form the action is at the bottom', async ({
  page,
}) => {
  await signUp(page, 'withdrawal-edit')
  const records = await seedRecords(page, 'Carla Cobrar')
  await page.goto(pathTo(WITHDRAWAL_EDIT, { id: records.withdrawal }))

  const dialog = page.getByRole('dialog', { name: 'Take from stock' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Promotion', exact: true })).toBeFocused()
  await expect(page.locator('.behind-pane')).toHaveAttribute('inert', '')
  await expectActionAtTheBottom(page, 'Save')

  // The tallest form: several lines push the main action below the fold, and it stays pinned.
  for (let line = 0; line < 4; line += 1) {
    await dialog.getByRole('button', { name: 'Add another variety' }).click()
  }
  await expect(dialog.getByLabel('Variety 5', { exact: true })).toBeAttached()
  await expectActionAtTheBottom(page, 'Save')
})
