/**
 * The business's own payment methods, over `api/client.ts` only: `GET /api/payment-methods`
 * (the offered ones, in the seller's order), `GET /api/payment-methods/archived`,
 * `POST /api/payment-methods`, `PATCH/DELETE /api/payment-methods/{id}`,
 * `POST /api/payment-methods/{id}/move|archive|restore` (`app/payment_methods/adapters/`).
 * The front never sorts the list: the order is the server's. One query key,
 * `keys.paymentMethods()`, with `staleTime: 0`: every mutation invalidates it on success, so a
 * Sheet reopened after a save reads the saved method and not a copy kept in local state.
 */

import { queryOptions } from '@tanstack/react-query'
import { del, get, patch, post } from './client'
import { keys } from './keys'
import type { PaymentMethodIcon } from '../components/paymentMethodIcons'

export interface PaymentMethodItem {
  id: number
  name: string
  icon: PaymentMethodIcon
  position: number
  in_use: boolean
}

export interface PaymentMethodIn {
  name: string
  icon: PaymentMethodIcon
}

export type MoveDirection = 'up' | 'down'

export function paymentMethodsQueryOptions() {
  return queryOptions({
    queryKey: keys.paymentMethods(),
    queryFn: () => get<PaymentMethodItem[]>('/api/payment-methods'),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export function archivedPaymentMethodsQueryOptions() {
  return queryOptions({
    queryKey: keys.archivedPaymentMethods(),
    queryFn: () => get<PaymentMethodItem[]>('/api/payment-methods/archived'),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

const urlOf = (id: number): string => `/api/payment-methods/${encodeURIComponent(String(id))}`

export function addPaymentMethod(body: PaymentMethodIn): Promise<PaymentMethodItem> {
  return post<PaymentMethodItem>('/api/payment-methods', body)
}

export function editPaymentMethod(id: number, body: Partial<PaymentMethodIn>): Promise<PaymentMethodItem> {
  return patch<PaymentMethodItem>(urlOf(id), body)
}

/** Answers the whole ordered list after the move. */
export function movePaymentMethod(id: number, direction: MoveDirection): Promise<PaymentMethodItem[]> {
  return post<PaymentMethodItem[]>(`${urlOf(id)}/move`, { direction })
}

export function archivePaymentMethod(id: number): Promise<void> {
  return post<void>(`${urlOf(id)}/archive`)
}

export function restorePaymentMethod(id: number): Promise<void> {
  return post<void>(`${urlOf(id)}/restore`)
}

export function deletePaymentMethod(id: number): Promise<void> {
  return del<void>(urlOf(id))
}
