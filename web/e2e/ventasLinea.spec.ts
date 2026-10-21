/**
 * Nueva venta's open line on a real phone viewport (320, 375 and 430 px, and 246 px, which
 * is 320 px at 130 % text): no field of the line, nor "Add another variety" or the
 * shipping field, leaves the screen; every control of them is at least 44 px tall and every
 * input at least 16 px, so iOS never zooms. The header, footer and date belong to the
 * shell's own spec, not to this one.
 */

import { SALE_NEW, VARIETIES } from '../src/routes.js'
import { expect, test } from './fixtures.js'
import type { Locator, Page } from '@playwright/test'
import { signUpNewBusiness } from './helpers/signup.js'
import { fillSaleLine } from './helpers/sale.js'
import { uniqueTag } from './helpers/unique.js'

const WIDTHS = [320, 375, 430, 246] as const
const TOUCH_TARGET = 44
const MIN_INPUT_FONT = 16

async function signUpWithAVariety(page: Page): Promise<void> {
  await signUpNewBusiness(page, { businessName: `Vivero Line ${uniqueTag()}`, email: `duena-linea-${uniqueTag()}@example.com` })
  await page.goto(VARIETIES)
  await page.getByRole('link', { name: 'New variety' }).click()
  await page.getByLabel('Name').fill('Jazmín con un nombre bastante largo')
  await page.getByRole('button', { name: 'Add the variety' }).click()
  await expect(page.getByText('Variety saved')).toBeVisible()
  await page.getByRole('link', { name: /Jazmín/ }).click()
  await page.getByRole('link', { name: 'New price' }).click()
  await page.getByLabel(/^List price/).fill('500')
  await page.getByRole('button', { name: 'Save the price' }).click()
  await expect(page.getByText('Price saved')).toBeVisible()
}

async function box(target: Locator): Promise<{ x: number; width: number; height: number }> {
  const rect = await target.boundingBox()
  if (rect === null) throw new Error('not rendered')
  return rect
}

test('the open line fits and is thumb-sized at 320, 375, 430 and at 130 % text', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signUpWithAVariety(page)

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 760 })
    await page.goto(SALE_NEW)
    await fillSaleLine(page, 1, {
      variety: 'Jazmín con un nombre bastante largo',
      grams: '12,5',
      specialPrice: '450',
    })

    const line = page.locator('.nueva-venta__linea--abierta')
    const controls = [
      page.getByLabel('Line 1 variety'),
      page.getByLabel('Line 1 grams'),
      page.getByLabel('Line 1 special price'),
      line.locator('.opcion-interruptor'),
      page.getByRole('button', { name: 'Add another variety' }),
      page.getByLabel('Shipping'),
    ]
    for (const control of controls) {
      const rect = await box(control)
      expect(rect.x, `left edge at ${width}`).toBeGreaterThanOrEqual(0)
      expect(rect.x + rect.width, `right edge at ${width}`).toBeLessThanOrEqual(width)
      expect(rect.height, `height at ${width}`).toBeGreaterThanOrEqual(TOUCH_TARGET)
    }
    for (const input of [
      page.getByLabel('Line 1 variety'),
      page.getByLabel('Line 1 grams'),
      page.getByLabel('Line 1 special price'),
      page.getByLabel('Shipping'),
    ]) {
      const size = await input.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))
      expect(size, `font size at ${width}`).toBeGreaterThanOrEqual(MIN_INPUT_FONT)
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, `horizontal overflow at ${width}`).toBeLessThanOrEqual(0)
  }
})
