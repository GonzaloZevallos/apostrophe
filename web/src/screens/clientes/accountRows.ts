/**
 * Which of a customer's account rows carries "Delete payment" (`payments.md`, "En
 * pantalla": it exists on every later payment, once). A later payment is exactly one
 * `payment` row; a sale row is never a later payment.
 */

import type { AccountRow, HowPaid, SaleAccountRow } from '../../api/payments'
import { CUSTOMERS_TEXT } from '../../copy/customers'
import { SALES_TEXT } from '../../copy/sales'
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
  /** The row's own figure: the sale's total or the payment's full amount. */
  own: string
  /** The running balance after the row, worded by `standing`. */
  balance: string
  balanceTone: BalanceTone
}

function assertNever(value: never): never {
  throw new Error(`Unhandled account row: ${JSON.stringify(value)}`)
}

/**
 * Everything one account row says, so the screen picks no copy or colour itself
 * (`payments.md`, "En pantalla: la ficha del cliente"). Reads only `kind`, `how_paid`,
 * `method`, the sale's number and `standing`, never the sign of an amount.
 */
export function ledgerRowView(row: AccountRow, money: MoneyFormatter): LedgerRowView {
  const balance =
    row.standing === 'credit'
      ? { balance: CUSTOMERS_TEXT.creditAmount(money.magnitude(row.running_balance)), balanceTone: 'credit' as const }
      : {
          balance: CUSTOMERS_TEXT.balanceAmount(money.money(row.running_balance)),
          balanceTone: row.standing === 'owes' ? ('debt' as const) : ('neutral' as const),
        }
  switch (row.kind) {
    case 'sale':
      return {
        title: SALES_TEXT.saleNumber(row.number),
        sub: saleSub(row.sale),
        own: money.money(row.sale.total),
        ...balance,
      }
    case 'payment':
      return {
        title: CUSTOMERS_TEXT.paymentTitle(row.payment.payment_method.name),
        sub: '',
        own: money.money(row.payment.amount),
        ...balance,
      }
  }
  return assertNever(row)
}

/**
 * The index of each later payment's row: every `payment` row, never a `sale` row's.
 * The API gives one row per payment, so each is deletable exactly once.
 */
export function deleteRowIndices(rows: readonly AccountRow[]): ReadonlySet<number> {
  const indices = new Set<number>()
  rows.forEach((row, index) => {
    if (row.kind === 'payment') indices.add(index)
  })
  return indices
}

/** A row's React key, from the id its own kind carries (never its index). */
export function rowKey(row: AccountRow): string {
  return row.kind === 'sale' ? `sale-${row.sale.id}` : `payment-${row.payment.id}`
}
