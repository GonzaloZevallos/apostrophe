/**
 * `fillSaleLine` (plan, "new-sale": "Tests"): the one seam every e2e sale fills a
 * line through, since `NuevaVenta`'s line editor (plan, "Binding UX decision")
 * only ever shows one line's own fields at a time — a line's `aria-label`s
 * ("Line N product", "Line N grams", ...) exist only while it is open.
 *
 * Line `n` opens first, if it isn't already: clicking "Add another product"
 * when it doesn't exist yet, or tapping its own closed row (named "Line N: " plus
 * its variety, or "Sin variedad") when it does but isn't the one currently open.
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
  const varietyField = page.getByRole('button', { name: new RegExp(`^Line ${n} product`) })
  // The lines render only once the varieties have arrived, and `count()` below does not
  // wait: read before that, it would see no line and add a second one. "Agregar otra
  // variedad" is on screen exactly when the lines are.
  await expect(page.getByRole('button', { name: 'Add another product' })).toBeVisible()
  if ((await varietyField.count()) === 0) {
    const closedRow = page.getByRole('button', { name: new RegExp(`^Line ${n}:`) })
    if ((await closedRow.count()) > 0) {
      await closedRow.click()
    } else {
      await page.getByRole('button', { name: 'Add another product' }).click()
    }
  }
  await expect(varietyField).toBeVisible()
  await varietyField.click()
  // The Selector's list is a dialog of buttons on a phone and a listbox of options on a computer.
  const listName = `Line ${n} product options`
  const list = page.getByRole('dialog', { name: listName }).or(page.getByRole('listbox', { name: listName }))
  await list.getByRole('button', { name: variety }).or(list.getByRole('option', { name: variety })).click()
  await page.getByLabel(`Line ${n} grams`, { exact: true }).fill(grams)
  if (gift === true) await page.getByLabel(`Line ${n} gift`, { exact: true }).check()
  if (specialPrice !== undefined) {
    await page.getByLabel(`Line ${n} special price`, { exact: true }).fill(specialPrice)
  }
}
