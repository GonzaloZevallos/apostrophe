/**
 * Record payment's pure rules: what the sheet opens with, whether a preview answer belongs to what
 * is in the field, which amount counts as an amount, the Save label and how a failed preview reads.
 * No rule here compares an amount with the customer's balance: only the server says whether a
 * payment is above it (`payment.above_balance`).
 */

import { ApiError, NetworkError } from '../../api/client'
import type { Customer } from '../../api/customers'
import type { MoneyFormatter } from '../../format/money'
import { instanceText } from '../../i18n/instanceText'

/** The amount and date a preview is asked for, or that sit in the form. */
export type PreviewKey = { amount: number | null; date: string }

/** The amount the sheet opens with: what an owing customer owes, nothing otherwise. */
export function openingAmount(customer: Customer): number | null {
  return customer.standing === 'owes' ? customer.balance : null
}

/** True only when the preview was asked for exactly the amount and date now in the field. */
export function previewIsCurrent(asked: PreviewKey, current: PreviewKey): boolean {
  return asked.amount !== null && current.amount !== null && asked.amount === current.amount && asked.date === current.date
}

/** The amount when it can be paid: above zero and a safe integer at the Money format's decimals. */
export function validAmount(amount: number | null, decimals: number): number | null {
  return amount !== null && Number.isSafeInteger(Math.round(amount * 10 ** decimals)) && amount > 0 ? amount : null
}

/** "Save payment · $ 11.000" for a valid amount, "Save payment" otherwise. */
export function savePaymentLabel(amount: number | null, money: MoneyFormatter): string {
  const valid = validAmount(amount, money.format.decimals)
  return valid === null
    ? instanceText('payments:savePaymentNoAmount')
    : instanceText('payments:savePayment', { amount: money.money(valid) })
}

/** Why a preview did not come: no connection, the server's refusal of an amount above what is owed, or anything else. */
export type PreviewFailure = 'offline' | 'above_balance' | 'other'

export function previewFailure(error: unknown): PreviewFailure | null {
  if (error === null || error === undefined) return null
  if (error instanceof NetworkError) return 'offline'
  if (error instanceof ApiError && error.code === 'payment.above_balance') return 'above_balance'
  return 'other'
}
