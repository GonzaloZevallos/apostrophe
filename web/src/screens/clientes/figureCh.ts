/**
 * `figureChOf`: the one number `OwedSummary` hands to CSS about its amounts, from the Money format
 * alone (CODING_STANDARDS: no amount is read in TypeScript).
 */

import type { MoneyFormat } from '../../format/money'

const NINE_DIGITS_WITH_DOTS_AND_SPACE = 11

/**
 * How many `ch` the widest amount can take in this Money format, from the format alone: the symbol,
 * then nine digits with their two dots and the space after the symbol, counted as 11 (the dots and
 * the space are narrower than a digit, so it is a ceiling), and the decimals with their separator.
 */
export function figureChOf(format: MoneyFormat): number {
  const symbolLength = Array.from(format.symbol).length
  const decimals = format.decimals > 0 ? format.decimals + 1 : 0
  return symbolLength + NINE_DIGITS_WITH_DOTS_AND_SPACE + decimals
}
