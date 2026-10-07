/**
 * Which of a customer's account rows carries "Borrar cobro" (`payments.md`, "On
 * screen": it exists on every later payment, once). A later payment can appear as
 * several `payment` rows (one per sale it settled), a `credit` row (what was left
 * over), or both; a sale row is never a later payment.
 */

import type { AccountRow } from '../../api/payments'

/**
 * The index of the first row of each later payment, among its `payment` and
 * `credit` rows, in the API's own row order; never a `sale` row's. That row is
 * the payment row whenever the payment has one, because
 * `app/payments/domain/account.py` lays a payment's split rows before its credit
 * row (pinned by the domain test in `tests/payments/test_account.py`); "exactly
 * once" does not depend on that order.
 */
export function deleteRowIndices(rows: readonly AccountRow[]): ReadonlySet<number> {
  const seen = new Set<number>()
  const indices = new Set<number>()
  rows.forEach((row, index) => {
    if (row.kind === 'sale' || seen.has(row.payment.id)) return
    seen.add(row.payment.id)
    indices.add(index)
  })
  return indices
}
