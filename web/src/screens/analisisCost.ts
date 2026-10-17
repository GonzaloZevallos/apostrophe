/**
 * The only code that turns an Análisis `RowCost` into text (Tech Lead's plan,
 * invariant 6). Whether a figure is entirely pending is the backend's answer
 * (`all_pending`); this module never works it out from an amount or from grams.
 * Profit, margin and the average margin keep `pendingSuffix` in `Analisis.tsx`.
 */

import type { RowCost } from '../api/analysis'
import { formatMoney } from '../format/money'
import { amountAndPending, pendingOnly } from '../format/pending'

/** "4 g not yet costed" when everything behind the figure is pending (never "$ 0"),
 * "$ 9.000 and 2,5 g not yet costed" when part of it is, "$ 9.000" when none is. */
export function formatRowCost(cost: RowCost): string {
  if (cost.all_pending) return pendingOnly(cost.pending_grams)
  if (cost.pending_grams > 0) return amountAndPending(cost.amount, cost.pending_grams)
  return formatMoney(cost.amount)
}
