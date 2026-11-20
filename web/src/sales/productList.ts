/**
 * New sale's Product list: what the "Most sold" section holds. Ids only, never a price: a row's
 * price comes from `pricing.ts`.
 */

import type { Variety } from '../screens/Variedades'

/** How many Most sold rows New sale draws: the 8 that `docs/product/sales.md` criterion 52 names
 * ("entre los 8 más vendidos"). It equals `SUGGESTIONS_PER_LIST` in
 * `app/sales/application/suggest_for_new_sale.py`, copied by hand because the front cannot import
 * it; the test that pins the 8 is what notices a change. */
export const MOST_SOLD_ROWS = 8

/** The suggested ids that become Most sold rows, in the suggestion order: those `products` returned,
 * that are not already lines of the sale, without repeats (the first position stays), at most `cap`.
 * It filters on ids only and never reads a price, so a Product with no price stays a row. */
export function mostSoldRows(
  ids: readonly number[],
  products: readonly Variety[],
  lineProductIds: readonly number[],
  cap: number,
): number[] {
  const returned = new Set(products.map((product) => product.id))
  const lines = new Set(lineProductIds)
  const seen = new Set<number>()
  const rows: number[] = []
  for (const id of ids) {
    if (!returned.has(id) || lines.has(id) || seen.has(id)) continue
    seen.add(id)
    rows.push(id)
  }
  return rows.slice(0, cap)
}
