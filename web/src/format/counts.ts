/**
 * The one author of a sales count's wording (plan invariants: "The sales-count wording
 * comes only from `salesCount`"). Home, Sales and Owed all word the same API figure the same
 * way by calling this, never by their own ternary. The words are in `copy/format.ts`.
 */

import { salesCount as salesCountWording } from '../copy/format'

/** `1` → `"1 sale"`; every other count, `0` included, → `"N sales"`. */
export function salesCount(n: number): string {
  return salesCountWording(n)
}
