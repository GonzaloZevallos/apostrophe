/**
 * The wording of a figure with grams not yet costed (Pending cost): the numbers come from
 * `formatMoney` and `formatGrams`, the words from `copy/format.ts`. Whether a figure is
 * entirely pending is the backend's answer; nothing here works it out.
 */

import { andPending, pendingOnly as pendingOnlyWording } from '../copy/format'
import { formatGrams, formatMoney } from './money'

/** `"4 g not yet costed"`: every gram behind the figure is pending (never `$ 0`). */
export function pendingOnly(grams: number): string {
  return pendingOnlyWording(formatGrams(grams))
}

/** `"$ 9.000 and 2,5 g not yet costed"`: part of the figure is pending. */
export function amountAndPending(amount: number, grams: number): string {
  return `${formatMoney(amount)} ${andPending(formatGrams(grams))}`
}

/** `" and 2,5 g not yet costed"` after a figure, or `""` when nothing is pending. */
export function pendingSuffix(grams: number): string {
  return grams > 0 ? ` ${andPending(formatGrams(grams))}` : ''
}
