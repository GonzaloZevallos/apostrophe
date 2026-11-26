/**
 * Where one Sale stands on being paid, as the words the seller reads: the one place that turns
 * `payment_state` and `still_owed` into a variant and a sentence. The chip draws the sentence and
 * the card's accessible name carries it, so the two can never say different things. It reads
 * only those two fields (never `still_owing`, the Payments or the Customer's Balance); a state or
 * an amount that cannot be shown is the `unknown` variant, never a guessed state or a $ 0. The
 * paid sentence, with or without the method of payment, is built only here.
 */

import type { TFunction } from 'i18next'
import type { Sale } from '../../api/sales'
import type { MoneyFormatter } from '../../format/money'

export interface PaymentView {
  variant: 'paid' | 'unpaid' | 'part_paid' | 'unknown'
  /** The formatted `still_owed`, only for `part_paid`. */
  amount: string | null
}

/** Marks the `switch` on `state` as exhaustive. It does not throw: a value outside the type (an
 * API answer from a newer server) reads the unknown line instead of breaking the screen. */
function assertNever(_state: never): void {}

const UNKNOWN: PaymentView = { variant: 'unknown', amount: null }

function partPaid(owed: number | null, money: MoneyFormatter): PaymentView {
  if (owed === null || !Number.isFinite(owed) || owed <= 0) return UNKNOWN
  const amount = money.money(owed)
  if (amount === money.money(0)) return UNKNOWN
  return { variant: 'part_paid', amount }
}

export function paymentView(state: Sale['payment_state'], stillOwed: Sale['still_owed'], money: MoneyFormatter): PaymentView {
  switch (state) {
    case 'paid':
      return { variant: 'paid', amount: null }
    case 'unpaid':
      return { variant: 'unpaid', amount: null }
    case 'part_paid':
      return partPaid(stillOwed, money)
    case null:
      return UNKNOWN
    default:
      assertNever(state)
      return UNKNOWN
  }
}

/** The sentence for a view, in the shown language. `method` (the name of how the sale was paid)
 * is read only for `paid`, and only when it is not blank. */
export function paymentText(t: TFunction, view: PaymentView, method?: string | null): string {
  switch (view.variant) {
    case 'paid': {
      const named = method?.trim() ?? ''
      return named === '' ? t('sales:card.payment.paid') : t('sales:card.payment.paidWith', { method: named })
    }
    case 'unpaid':
      return t('sales:card.payment.unpaid')
    case 'part_paid':
      return t('sales:card.payment.partPaid', { amount: view.amount })
    case 'unknown':
      return t('sales:card.payment.unknown')
  }
}
