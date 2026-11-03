/**
 * `GET /customer-types` (`app/customer_types/adapters/schemas.py`): the Business's own
 * customer types, read by the Customer form's picker and the Customer's detail page. The
 * Settings screen that manages them writes through its own module.
 */

import { queryOptions, useQuery } from '@tanstack/react-query'
import { get } from './client'
import { keys } from './keys'

/** The closed set of icon keys the API answers; `customerTypes/icons.ts` maps each one. */
export type CustomerTypeIconKey = 'circle' | 'star' | 'heart' | 'diamond' | 'flag' | 'tag' | 'crown' | 'bell'

export interface CustomerType {
  id: number
  name: string
  icon: CustomerTypeIconKey
  is_vip: boolean
}

export function customerTypesQueryOptions() {
  return queryOptions({
    queryKey: keys.customerTypes(),
    queryFn: () => get<CustomerType[]>('/customer-types'),
  })
}

export function useCustomerTypes() {
  return useQuery(customerTypesQueryOptions())
}
