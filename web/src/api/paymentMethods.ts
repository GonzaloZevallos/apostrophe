/**
 * The business's payment methods (`GET /api/payment-methods`): the active ones, in the seller's
 * order, each with the icon key `components/paymentMethodIcons.ts` draws. The pickers (New sale,
 * Record payment) read this list; a method that was archived or deleted is simply not in it.
 * Refetched on every mount (`staleTime: 0`) so a change made in Settings, or by a partner, shows
 * the next time a picker opens.
 */

import { type QueryClient, queryOptions, useQuery } from '@tanstack/react-query'
import { get } from './client'
import { keys } from './keys'

export interface PaymentMethod {
  id: number
  name: string
  /** One of the six wire keys of `paymentMethodIcons`. */
  icon: string
  position: number
  is_used: boolean
}

export function listPaymentMethods(): Promise<PaymentMethod[]> {
  return get<PaymentMethod[]>('/api/payment-methods')
}

export function paymentMethodsQuery() {
  return queryOptions({
    queryKey: keys.paymentMethods(),
    queryFn: listPaymentMethods,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export function usePaymentMethods() {
  return useQuery(paymentMethodsQuery())
}

/** Fetches the list again now and answers it; a failed fetch answers the list already cached. */
export async function refreshPaymentMethods(queryClient: QueryClient): Promise<PaymentMethod[]> {
  try {
    return await queryClient.fetchQuery({ ...paymentMethodsQuery(), staleTime: 0 })
  } catch {
    return queryClient.getQueryData<PaymentMethod[]>(keys.paymentMethods()) ?? []
  }
}

/** The refusal a save answers with for a method that is archived, deleted or another business's. */
export const PAYMENT_METHOD_UNAVAILABLE = 'payment_method.unavailable'
