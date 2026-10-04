/**
 * `fillSaleLine` (plan, "new-sale": "Tests"): the one seam every e2e sale fills a
 * line through, since `NuevaVenta`'s line editor (plan, "Binding UX decision")
 * only ever shows one line's own fields at a time — a line's `aria-label`s
 * ("Variedad línea N", "Gramos línea N", ...) exist only while it is open.
 *
 * Line `n` opens first, if it isn't already: clicking "Agregar otra variedad"
 * when it doesn't exist yet, or tapping its own closed row (named "Línea N: " plus
 * its variety, or "Sin variedad") when it does but isn't the one currently open.
 * Only then are its fields filled.
 */

import { expect, type Page } from '@playwright/test'

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
  const varietyField = page.getByLabel(`Variedad línea ${n}`)
  if ((await varietyField.count()) === 0) {
    const closedRow = page.getByRole('button', { name: new RegExp(`^Línea ${n}:`) })
    if ((await closedRow.count()) > 0) {
      await closedRow.click()
    } else {
      await page.getByRole('button', { name: 'Agregar otra variedad' }).click()
    }
  }
  await expect(varietyField).toBeVisible()
  await varietyField.selectOption({ label: variety })
  await page.getByLabel(`Gramos línea ${n}`).fill(grams)
  if (gift === true) await page.getByLabel(`Regalo línea ${n}`).check()
  if (specialPrice !== undefined) {
    await page.getByLabel(`Precio especial línea ${n}`).fill(specialPrice)
  }
}
