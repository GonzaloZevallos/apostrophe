/**
 * The only code that turns an Análisis `RowCost` into text (Tech Lead's plan,
 * invariant 6). Whether a figure is entirely pending is the backend's answer
 * (`all_pending`); this module never works it out from an amount or from grams.
 * Profit, margin and the average margin keep `pendingSuffix` in `Analisis.tsx`.
 */

import type { RowCost } from '../api/analysis'
import { formatGrams, formatMoney } from '../format/money'

/** "4 g sin costo" when everything behind the figure is pending (never "$ 0"),
 * "$ 9.000 y 2,5 g sin costo" when part of it is, "$ 9.000" when none is. */
export function formatRowCost(cost: RowCost): string {
  if (cost.all_pending) return `${formatGrams(cost.pending_grams)} sin costo`
  if (cost.pending_grams > 0) {
    return `${formatMoney(cost.amount)} y ${formatGrams(cost.pending_grams)} sin costo`
  }
  return formatMoney(cost.amount)
}
