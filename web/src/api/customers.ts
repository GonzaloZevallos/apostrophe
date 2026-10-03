/**
 * The customer resource, over `api/client.ts` only (plan, invariants): no screen
 * calls `fetch` directly. Matches `app/customers/adapters/schemas.py` field for
 * field.
 */

import { get, patch, post } from './client'

export type Channel = 'telegram' | 'whatsapp'

export interface Customer {
  id: number
  name: string
  phone: string
  channel: Channel | null
  vip: boolean
}

export interface CustomerIn {
  name: string
  phone: string
  channel: Channel | null
  vip: boolean
}

export type CustomerPatchIn = Partial<CustomerIn>

export function listCustomers(q: string): Promise<Customer[]> {
  const search = q.trim() === '' ? '' : `?q=${encodeURIComponent(q)}`
  return get<Customer[]>(`/customers${search}`)
}

export function getCustomer(id: string): Promise<Customer> {
  return get<Customer>(`/customers/${encodeURIComponent(id)}`)
}

export function registerCustomer(body: CustomerIn): Promise<Customer> {
  return post<Customer>('/customers', body)
}

export function editCustomer(id: string, body: CustomerPatchIn): Promise<Customer> {
  return patch<Customer>(`/customers/${encodeURIComponent(id)}`, body)
}
