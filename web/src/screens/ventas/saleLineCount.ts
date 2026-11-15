/**
 * `productCount`: how many lines of the sale have a Product chosen, whatever their grams. The one
 * derivation behind the "Sale in progress" strip (its presence and its N) and the toast wording
 * after an Expense is saved over New sale. A blank line, and a line with grams, a Gift flag or a
 * special price but no Product, do not count; a Gift line and a Special-price line with one do.
 */

import type { LineState } from './NuevaVentaLinea'

export function productCount(lines: readonly LineState[]): number {
  return lines.filter((line) => line.varietyId !== '').length
}
