/**
 * The customer types resource, over `api/client.ts` only: `GET/POST /customer-types`,
 * `PATCH/DELETE /customer-types/{id}` (`app/customer_types/adapters/schemas.py`). `is_vip` is
 * read-only: it marks the VIP type the upgrade created and is never sent. The list is what the
 * Prices screen reads to pick its help line, whether or not the switch is on.
 */

import { queryOptions } from '@tanstack/react-query'
import { del, get, patch, post } from './client'
import { keys } from './keys'

/** The closed set of icon keys; checked against the OpenAPI snapshot by `customerTypeIcons.test.ts`. */
export type CustomerTypeIconKey =
  | 'circle'
  | 'star'
  | 'heart'
  | 'diamond'
  | 'flag'
  | 'tag'
  | 'crown'
  | 'bell'

export interface CustomerType {
  id: number
  name: string
  icon: CustomerTypeIconKey
  is_vip: boolean
}

export interface CustomerTypeIn {
  name: string
  icon: CustomerTypeIconKey
}

export function customerTypesQueryOptions() {
  return queryOptions({
    queryKey: keys.customerTypes(),
    queryFn: () => get<CustomerType[]>('/customer-types'),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export function createCustomerType(body: CustomerTypeIn): Promise<CustomerType> {
  return post<CustomerType>('/customer-types', body)
}

export function editCustomerType(id: number, body: Partial<CustomerTypeIn>): Promise<CustomerType> {
  return patch<CustomerType>(`/customer-types/${encodeURIComponent(String(id))}`, body)
}

export function deleteCustomerType(id: number): Promise<void> {
  return del<void>(`/customer-types/${encodeURIComponent(String(id))}`)
}
