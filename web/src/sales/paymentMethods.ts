/**
 * The Payment methods a Selector offers: the business's own offered list (`GET /api/payment-methods`,
 * ADR-0084), in the order the server keeps it, read by New sale and Record payment alike. They are
 * never a fixed set (`fixedSets.ts` never declares them). The Selector's values are the ids as text;
 * `paymentMethodOf` turns one back into the id the API takes.
 *
 * A failed read never loses what the seller typed: offline the screen shows Estados' "Sin conexión"
 * notice, on a server error the field itself says it could not load, and tapping the field again
 * reads the list again.
 */

import { type QueryClient, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { PaymentMethod } from '../api/payments'
import { paymentMethodsQueryOptions } from '../api/paymentMethods'
import { keys } from '../api/keys'
import { NetworkError } from '../api/client'
import type { SelectorOption } from '../components/Selector'

export interface PaymentMethodOption extends SelectorOption {
  value: string
}

export interface PaymentMethodOptions {
  /** What a `Selector` takes as props. */
  selector: {
    required: true
    options: readonly PaymentMethodOption[]
    loading: boolean
    emptySetMessage: string
  }
  /** The reading failed: `offline` shows the notice, `server` marks the field. */
  failure: 'offline' | 'server' | null
  /** Reads the list again (a tap on a field that failed). */
  reload: () => void
}

export function usePaymentMethodOptions(): PaymentMethodOptions {
  const { t } = useTranslation()
  const query = useQuery(paymentMethodsQueryOptions())
  const failed = query.isError && query.data === undefined
  const failure = !failed ? null : query.error instanceof NetworkError ? 'offline' : 'server'
  return {
    selector: {
      required: true,
      options: (query.data ?? []).map((method) => ({ value: String(method.id), label: method.name })),
      loading: query.isPending && !failed,
      emptySetMessage: t(failed ? 'emptyStates:selectorPaymentMethodsFailed' : 'emptyStates:selectorNoPaymentMethods'),
    },
    failure,
    reload: () => {
      void query.refetch()
    },
  }
}

/** The id a Selector value stands for, or null for anything else (never a guess). */
export function paymentMethodOf(value: string | null): PaymentMethod | null {
  if (value === null || !/^\d+$/.test(value)) return null
  return Number(value)
}

/** The Selector value of a chosen method id. */
export function paymentMethodValue(method: PaymentMethod | null): string | null {
  return method === null ? null : String(method)
}

/** The name the list showed for a method id, read before the list is read again (never a guess). */
export function paymentMethodName(queryClient: QueryClient, method: PaymentMethod): string | null {
  const list = queryClient.getQueryData<readonly { id: number; name: string }[]>(keys.paymentMethods())
  return list?.find((item) => item.id === method)?.name ?? null
}
