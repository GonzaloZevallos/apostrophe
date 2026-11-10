/**
 * The Payment methods a Selector offers: the business's own active methods, in the seller's
 * order, read from `GET /api/payment-methods` (`api/paymentMethods.ts`) and shared by New sale and
 * Record payment. They are a Growable set, never a fixed one (`fixedSets.ts` never declares them).
 * An option's value is the method's id as text; `paymentMethodIdOf` turns a chosen value back into
 * the id the API takes. The names are the seller's data, shown as written.
 */

import { usePaymentMethods } from '../api/paymentMethods'
import type { SelectorOption } from '../components/Selector'
import { PAYMENT_METHODS_TEXT } from '../copy/paymentMethods'

export interface PaymentMethodOptions {
  required: true
  options: readonly SelectorOption[]
  loading: boolean
  emptySetMessage: string
}

/** The list a Selector draws: loading while the query is pending, never reordered. */
export function usePaymentMethodOptions(): PaymentMethodOptions {
  const methods = usePaymentMethods()
  return {
    required: true,
    loading: methods.isPending,
    emptySetMessage: PAYMENT_METHODS_TEXT.methodsEmpty,
    options: (methods.data ?? []).map((method) => ({ value: String(method.id), label: method.name })),
  }
}

/** The id a Selector value stands for, or null for anything else (never a guess). */
export function paymentMethodIdOf(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null
  return Number(value)
}
