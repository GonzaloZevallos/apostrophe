/**
 * `figureChOf`: the one number `OwedSummary` hands to CSS about its amounts, from the Money format
 * alone (CODING_STANDARDS: no amount is read in TypeScript).
 */

import type { MoneyFormat } from '../../format/money'

const NINE_DIGITS_WITH_DOTS = 11
const SPACE_AFTER_SYMBOL = 1

/**
 * How many `ch` the widest amount can take in this Money format, from the format alone: the symbol
 * counted twice (it can be wider than a digit), the space, nine digits with their two dots and the
 * decimals with their separator.
 */
export function figureChOf(format: MoneyFormat): number {
  const symbolLength = Array.from(format.symbol).length
  const decimals = format.decimals > 0 ? format.decimals + 1 : 0
  return 2 * symbolLength + SPACE_AFTER_SYMBOL + NINE_DIGITS_WITH_DOTS + decimals
}
