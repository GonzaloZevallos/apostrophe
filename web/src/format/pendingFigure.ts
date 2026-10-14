/**
 * The one way a cost figure on Análisis is written (ADR-0020 amendment, GH-141): the
 * amount, "y N g sin costo" when part of it is pending, and "N g sin costo" alone when
 * all of it is. `allPending` is the backend's answer (`all_pending`); this never
 * compares an amount to decide the form, because a lot recorded with no cost costs $0
 * too and a $0 amount says nothing about pending.
 */

import { formatGrams, formatMoney } from './money'

export interface PendingFigureInput {
  amount: number
  pendingGrams: number
  allPending: boolean
}

export function pendingFigure({ amount, pendingGrams, allPending }: PendingFigureInput): string {
  if (allPending) return `${formatGrams(pendingGrams)} sin costo`
  if (pendingGrams > 0) return `${formatMoney(amount)} y ${formatGrams(pendingGrams)} sin costo`
  return formatMoney(amount)
}
