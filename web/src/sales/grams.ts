/**
 * `saleGrams` (plan, invariants: "on Ventas rows from `saleGrams`"): the one place
 * `Ventas`' rows sum a sale's grams for display — never a screen's own reduce.
 * Works in integer hundredths, through `hundredthsOfApiGrams`/`fromHundredths`
 * (`sales/pricing.ts`), the same two conversions every other grams sum in the
 * front uses, gifts included (a gift line still has grams, just no price). Tested
 * equal to the API's own `total_grams` (`SaleDetail`), so the two authors of a
 * sale's grams — this function and the backend's — are caught drifting apart.
 */

import { fromHundredths, hundredthsOfApiGrams } from './pricing'

export interface LineForGrams {
  grams: number
}

export function saleGrams(lines: readonly LineForGrams[]): number {
  let hundredths = 0
  for (const line of lines) {
    hundredths += hundredthsOfApiGrams(line.grams)
  }
  return fromHundredths(hundredths)
}
