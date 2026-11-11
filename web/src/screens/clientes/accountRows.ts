/**
 * Which of a customer's account rows carries "Delete payment" (`payments.md`, "En
 * pantalla": it exists on every later payment, once). A later payment can appear as
 * several `payment` rows (one per sale it settled), a `credit` row (what was left
 * over), or both; a sale row is never a later payment.
 */

import type { AccountRow, HowPaid, SaleAccountRow } from '../../api/payments'
import { CUSTOMERS_TEXT } from '../../copy/customers'
import { formatDateShort } from '../../format/dates'
import type { MoneyFormatter } from '../../format/money'

/** What a sale row says under "Sale": total, so a new `HowPaid` fails to compile here. A paid
 * sale names its method instead (`saleSub`), from the row's `payment_method`. */
const HOW_PAID_SUB: Record<Exclude<HowPaid, 'paid'>, string> = {
  owing: CUSTOMERS_TEXT.leftOwing,
  none: CUSTOMERS_TEXT.nothingToPay,
}

function saleSub(sale: SaleAccountRow['sale']): string {
  if (sale.how_paid !== 'paid') return HOW_PAID_SUB[sale.how_paid]
  // A paid sale always carries its method; the guard keeps the row readable if it did not.
  return sale.payment_method === null ? CUSTOMERS_TEXT.paid : CUSTOMERS_TEXT.paidWith(sale.payment_method.name)
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
 * `method`, the sale's date and `standing`, never the sign of an amount.
 */
export function ledgerRowView(row: AccountRow, money: MoneyFormatter): LedgerRowView {
  const balance =
    row.standing === 'credit'
      ? { balance: CUSTOMERS_TEXT.creditAmount(money.magnitude(row.running_balance)), balanceTone: 'credit' as const }
      : {
          balance: CUSTOMERS_TEXT.balanceAmount(money.money(row.running_balance)),
          balanceTone: row.standing === 'owes' ? ('debt' as const) : ('neutral' as const),
        }
  if (row.kind === 'sale') {
    return {
      title: CUSTOMERS_TEXT.saleTitle,
      sub: saleSub(row.sale),
      own: money.money(row.sale.total),
      ...balance,
    }
  }
  const title = CUSTOMERS_TEXT.paymentTitle(row.payment.payment_method.name)
  if (row.kind === 'payment') {
    return {
      title,
      sub: CUSTOMERS_TEXT.onAccountOf(formatDateShort(row.applied_to.sale_date)),
      own: money.money(row.applied_to.amount),
      ...balance,
    }
  }
  return { title, sub: CUSTOMERS_TEXT.creditLabel, own: money.magnitude(row.amount), ...balance }
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
