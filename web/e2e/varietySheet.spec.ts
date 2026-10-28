/**
 * A variety's rename as a sheet on a phone (ADR-0053): its action sits at the bottom of the
 * sheet within the bottom inset, and the page behind stays locked while the sheet or its
 * leave confirmation is on screen, with the scroll position where it was. A direct address to
 * New variety opens it over Varieties. Roles, names, text and URLs only.
 */

import { VARIETY_NEW, VARIETY, pathTo } from '../src/routes.js'
import { expect, test } from './fixtures.js'
import { seedRecords, signUp } from './helpers/seed.js'

test.use({ viewport: { width: 390, height: 844 } })

test('a direct address to New variety opens the sheet over Varieties, focus on the name', async ({ page }) => {
  await signUp(page, 'sheet-open')
  await page.goto(VARIETY_NEW)

  const dialog = page.getByRole('dialog', { name: 'New variety' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: /^Name/ })).toBeFocused()
  await expect(dialog.getByRole('button', { name: 'Close' })).toHaveCount(1)
  await expect(page.locator('.behind-pane')).toHaveAttribute('inert', '')
})

test('the rename sheet keeps its action at the bottom, and the page stays locked until the sheet and its question are gone', async ({
  page,
}) => {
  await signUp(page, 'sheet-edit')
  const records = await seedRecords(page, 'Carla Cobrar')
  await page.goto(pathTo(VARIETY, { id: records.variety }))
  // A short window makes the page scroll; scroll it to the bottom first, so "where it was" is a
  // real, non-zero position. The opener is clicked without scrolling it into view.
  await page.setViewportSize({ width: 390, height: 480 })
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  const startedAt = await page.evaluate(() => window.scrollY)
  expect(startedAt).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Edit name' }).dispatchEvent('click')

  const dialog = page.getByRole('dialog', { name: 'Rename variety' })
  await expect(dialog).toBeVisible()
  const save = dialog.getByRole('button', { name: 'Save the name' })
  await expect(save).toBeInViewport()
  // `.sheet__actions` ends at the sheet's bottom: its own padding (a spacing step plus
  // `--inset-abajo`) is all that lies between the action and that edge.
  const padding = await page
    .locator('.sheet__actions')
    .evaluate((element) => parseFloat(getComputedStyle(element).paddingBottom))
  const sheet = await page.locator('.sheet').boundingBox()
  const box = await save.boundingBox()
  if (sheet === null || box === null) throw new Error('no box')
  expect(Math.abs(sheet.y + sheet.height - (box.y + box.height) - padding)).toBeLessThanOrEqual(1)

  const locked = () => page.evaluate(() => getComputedStyle(document.documentElement).overflow === 'hidden')
  const scrollY = () => page.evaluate(() => window.scrollY)
  const before = await scrollY()
  expect(before).toBe(startedAt)
  expect(await locked()).toBe(true)

  // Something typed, then Close: the question is on screen over the sheet.
  await dialog.getByRole('textbox', { name: /^Name/ }).fill('Renamed')
  await dialog.getByRole('button', { name: 'Close' }).click()
  const question = page.getByRole('alertdialog', { name: 'Discard the change?' })
  await expect(question).toBeVisible()
  expect(await locked()).toBe(true)

  // The question goes first (keep typing): the sheet is still there and the page still locked.
  await question.getByRole('button', { name: 'No, keep typing' }).click()
  await expect(question).toBeHidden()
  await expect(dialog).toBeVisible()
  expect(await locked()).toBe(true)

  // Then both go (discard): only now the page is free, where it was.
  await dialog.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('alertdialog', { name: 'Discard the change?' }).getByRole('button', { name: 'Yes, discard it' }).click()
  await expect(dialog).toBeHidden()
  await expect.poll(locked).toBe(false)
  expect(Math.abs((await scrollY()) - before)).toBeLessThanOrEqual(2)
})

test('Back closes the rename sheet first and leaves the variety page where it was', async ({ page }) => {
  await signUp(page, 'sheet-back')
  const records = await seedRecords(page, 'Carla Cobrar')
  const address = pathTo(VARIETY, { id: records.variety })
  await page.goto(address)
  await page.getByRole('button', { name: 'Edit name' }).click()
  const dialog = page.getByRole('dialog', { name: 'Rename variety' })
  await expect(dialog).toBeVisible()

  await page.goBack()
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(new RegExp(`${address}$`))
  await expect(page.getByRole('button', { name: 'Edit name' })).toBeVisible()
})
