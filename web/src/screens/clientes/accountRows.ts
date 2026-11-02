/**
 * Which of a customer's account rows carries "Delete payment" (`payments.md`, "En
 * pantalla": it exists on every later payment, once). A later payment can appear as
 * several `payment` rows (one per sale it settled), a `credit` row (what was left
 * over), or both; a sale row is never a later payment.
 */

import type { AccountRow, HowPaid } from '../../api/payments'
import { CUSTOMERS_TEXT } from '../../copy/customers'
import { formatDateShort } from '../../format/dates'
import { formatMoney, formatMoneyMagnitude } from '../../format/money'

/** What a sale row says under "Sale", from how it was paid; the method's name is the seller's own. */
function howPaidSub(howPaid: HowPaid): string {
  switch (howPaid.kind) {
    case 'method':
      return CUSTOMERS_TEXT.paidWith(howPaid.name)
    case 'owing':
      return CUSTOMERS_TEXT.leftOwing
    case 'none':
      return CUSTOMERS_TEXT.nothingToPay
  }
}

export type BalanceTone = 'debt' | 'credit' | 'neutral'

export interface LedgerRowView {
  title: string
  sub: string
  /** The row's own figure: the sale's total, the amount applied, or the credit left. */
  own: string
  /** The running balance after the row, worded by `standing`. */
  balance: string
  balanceTone: BalanceTone
}

/**
 * Everything one account row says, so the screen picks no copy or colour itself
 * (`payments.md`, "En pantalla: la ficha del cliente"). Reads only `kind`, `how_paid`,
 * the payment's method name, the sale's date and `standing`, never the sign of an amount.
 */
export function ledgerRowView(row: AccountRow): LedgerRowView {
  const balance =
    row.standing === 'credit'
      ? { balance: CUSTOMERS_TEXT.creditAmount(formatMoneyMagnitude(row.running_balance)), balanceTone: 'credit' as const }
      : {
          balance: CUSTOMERS_TEXT.balanceAmount(formatMoney(row.running_balance)),
          balanceTone: row.standing === 'owes' ? ('debt' as const) : ('neutral' as const),
        }
  if (row.kind === 'sale') {
    return {
      title: CUSTOMERS_TEXT.saleTitle,
      sub: howPaidSub(row.sale.how_paid),
      own: formatMoney(row.sale.total),
      ...balance,
    }
  }
  const title = CUSTOMERS_TEXT.paymentWith(row.payment.name)
  if (row.kind === 'payment') {
    return {
      title,
      sub: CUSTOMERS_TEXT.onAccountOf(formatDateShort(row.applied_to.sale_date)),
      own: formatMoney(row.applied_to.amount),
      ...balance,
    }
  }
  return { title, sub: CUSTOMERS_TEXT.creditLabel, own: formatMoneyMagnitude(row.amount), ...balance }
}

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

/** A row's React key, from the ids its own kind carries (never its index). A
 * payment settles a given sale in at most one split, so `payment`+`sale` is unique. */
export function rowKey(row: AccountRow): string {
  if (row.kind === 'sale') return `sale-${row.sale.id}`
  if (row.kind === 'payment') return `payment-${row.payment.id}-${row.applied_to.sale_id}`
  return `credit-${row.payment.id}`
}
