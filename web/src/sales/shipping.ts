/**
 * The shipping charged on New sale, one parser for the routed screen and for `newSalePricing.ts`.
 */

import type { MoneyFormat } from '../format/money'
import { parseMoneyInput } from '../format/parse'

/** Shipping charged: zero or more, unlike `parseMoneyInput`, which rejects zero — `0` is its default
 * and a valid value to save with. Anything else goes through `parseMoneyInput`. */
export function parseShipping(input: string, format: MoneyFormat): number | null {
  if ((format.decimals === 0 ? /^0+$/ : /^0+([,.]0*)?$/).test(input.trim())) return 0
  const parsed = parseMoneyInput(input, format)
  return parsed.ok ? parsed.value : null
}
