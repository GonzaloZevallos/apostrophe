/**
 * The phone's Products segment keeps the seller where they worked (GH-898): Stock, + Stock entry,
 * save, and the seller is still on Stock with "Entry saved". Roles, names, text and URLs only.
 */

import { VARIETIES } from '../src/routes.js'
import { expect, test } from './fixtures.js'
import { watchConsole } from './console.js'
import { STOCK_COST_LABEL } from './helpers/labels.js'
import { seedRecords, signUp } from './helpers/seed.js'
import { openStockSegment } from './helpers/stockSegment.js'
import { pickStockVariety } from './helpers/stockVariety.js'
import { expectToast } from './helpers/toast.js'
import { expectPath } from './helpers/url.js'

test.use({ viewport: { width: 390, height: 844 } })

test('a seller saves a stock entry from Stock and is still on Stock with "Entry saved"', async ({ page }) => {
  const consoleMessages: string[] = []
  watchConsole(page, consoleMessages)
  await signUp(page, 'Segmento')
  await seedRecords(page, 'Carla Segmento')

  await page.goto(VARIETIES)
  await expect(page.getByRole('link', { name: 'Send catalog' })).toBeVisible()
  await expect(page.getByRole('link', { name: '+ Stock entry' })).toHaveCount(0)

  await openStockSegment(page)
  await page.getByRole('link', { name: '+ Stock entry' }).click()
  await page.getByLabel('Grams', { exact: true }).fill('20')
  await pickStockVariety(page, 'Rosa')
  await page.getByLabel(STOCK_COST_LABEL, { exact: true }).fill('9000')
  await expectToast(page, 'Entry saved', () => page.getByRole('button', { name: 'Save the entry' }).click())

  await expectPath(page, VARIETIES)
  const group = page.getByRole('group', { name: 'Products view' })
  await expect(group.getByRole('button', { name: 'Stock', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('link', { name: '+ Stock entry' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Send catalog' })).toHaveCount(0)
  expect(consoleMessages).toEqual([])
})
