/**
 * `fillSaleLine` (plan, "new-sale": "Tests"): the one seam every e2e sale fills a
 * line through, since `NuevaVenta`'s line editor (plan, "Binding UX decision")
 * only ever shows one line's own fields at a time — a line's `aria-label`s
 * ("Variety line N", "Grams line N", ...) exist only while it is open.
 *
 * Line `n` opens first, if it isn't already: clicking "Add another variety"
 * when it doesn't exist yet, or tapping its own closed row (named "Line N: " plus
 * its variety, or "No variety") when it does but isn't the one currently open.
 * Only then are its fields filled.
 */

import { expect } from '../fixtures.js'
import type { Page } from '@playwright/test'

export interface SaleLineInput {
  variety: string
  grams: string
  gift?: boolean
  specialPrice?: string
}

export async function fillSaleLine(
  page: Page,
  n: number,
  { variety, grams, gift, specialPrice }: SaleLineInput,
): Promise<void> {
  const varietyField = page.getByLabel(`Variety line ${n}`)
  // The lines render only once the varieties have arrived, and `count()` below does not
  // wait: read before that, it would see no line and add a second one. "Agregar otra
  // variedad" is on screen exactly when the lines are.
  await expect(page.getByRole('button', { name: 'Add another variety' })).toBeVisible()
  if ((await varietyField.count()) === 0) {
    const closedRow = page.getByRole('button', { name: new RegExp(`^Line ${n}:`) })
    if ((await closedRow.count()) > 0) {
      await closedRow.click()
    } else {
      await page.getByRole('button', { name: 'Add another variety' }).click()
    }
  }
  await expect(varietyField).toBeVisible()
  await varietyField.selectOption({ label: variety })
  await page.getByLabel(`Grams line ${n}`).fill(grams)
  if (gift === true) await page.getByLabel(`Gift line ${n}`).check()
  if (specialPrice !== undefined) {
    await page.getByLabel(`Special price line ${n}`).fill(specialPrice)
  }
}
