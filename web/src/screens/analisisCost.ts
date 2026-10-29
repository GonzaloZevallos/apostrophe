/**
 * The only code that turns an Análisis `RowCost` into text (Tech Lead's plan,
 * invariant 6). Whether a figure is entirely pending is the backend's answer
 * (`all_pending`); this module never works it out from an amount or from grams.
 * Profit, margin and the average margin keep `pendingSuffix` in `Analisis.tsx`.
 */

import type { RowCost } from '../api/analysis'
import { formatGrams, formatMoney } from '../format/money'
import { ANALYSIS_TEXT } from '../copy/analysis'

/** A figure split for the screen: the amount (absent when all of it is pending, never a
 * "$ 0") and its marker, kept apart so each sits in its own element. The marker keeps its
 * copy exactly, leading space included, so label + ' ' + amount + marker reads as before. */
export type AmountParts = { amount: string | null; marker: string }

/** A plain amount with its own "and N g without cost", only when grams are pending. */
export function amountParts(amount: number, pendingGrams: number): AmountParts {
  return {
    amount: formatMoney(amount),
    marker: pendingGrams > 0 ? ANALYSIS_TEXT.pendingSuffix(formatGrams(pendingGrams)) : '',
  }
}

/** "4 g without cost" alone when everything behind the figure is pending (never "$ 0"),
 * "$ 9.000" + " and 2,5 g without cost" when part of it is, "$ 9.000" when none is. */
export function rowCostParts(cost: RowCost): AmountParts {
  if (cost.all_pending) {
    return { amount: null, marker: ANALYSIS_TEXT.noCostAlone(formatGrams(cost.pending_quantity)) }
  }
  return amountParts(cost.amount, cost.pending_quantity)
}
