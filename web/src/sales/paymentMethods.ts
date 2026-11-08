/**
 * The Payment methods a Selector offers: Cash and Transfer, built once from the Copy module and
 * read by New sale and Record payment alike. They are the app's own list, not a fixed set
 * (`fixedSets.ts` never declares them) and not yet the business's own: GH-318 replaces this hook
 * and nothing else. The values are the ones the API takes (`PaymentMethod`).
 */

import { useTranslation } from 'react-i18next'
import type { PaymentMethod } from '../api/payments'
import type { SelectorOption } from '../components/Selector'

export interface PaymentMethodOption extends SelectorOption {
  value: PaymentMethod
}

export interface PaymentMethodOptions {
  builtIn: true
  required: true
  options: readonly [PaymentMethodOption, ...PaymentMethodOption[]]
}

/** The built-in list: it is never loading and never empty, so it has no empty-set message. */
export function usePaymentMethodOptions(): PaymentMethodOptions {
  const { t } = useTranslation()
  return {
    builtIn: true,
    required: true,
    options: [
      { value: 'cash', label: t('common:cashMethod') },
      { value: 'transfer', label: t('common:transfer') },
    ],
  }
}

/** The API's `PaymentMethod` a Selector value stands for, or null for anything else (never a guess). */
export function paymentMethodOf(value: string | null): PaymentMethod | null {
  return value === 'cash' || value === 'transfer' ? value : null
}
