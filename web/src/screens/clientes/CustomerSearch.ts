/**
 * The search query the /clientes layout route holds (plan, "Search"): a React
 * context, never the URL and never storage, so it survives going from the list to
 * a card or a form and back without ever naming a business or a customer in a
 * link. The selected segment (All | Owed to you) lives beside it, for the same reason: it
 * survives a trip to a card and back, and is never kept on the device, in the URL or on the server.
 * `setQuery` never writes it.
 *
 * `debtorsState` and `customersView` are the one decision of what Customers draws: they read
 * which answers exist, never a count, a bucket or a money amount.
 */

import { createContext, useContext } from 'react'
import type { CUSTOMER_SEGMENTS, FixedValue } from '../../components/fixedSets'
import type { Debtors } from '../../api/payments'

export type CustomerSegment = FixedValue<typeof CUSTOMER_SEGMENTS>

export interface CustomerSearchValue {
  query: string
  setQuery: (query: string) => void
  segment: CustomerSegment
  setSegment: (segment: CustomerSegment) => void
}

export type DebtorsState = 'pending' | 'ready' | 'failed'

/** `ready` while data is present (even refetching or after a failed refetch), `failed` with none and an error. */
export function debtorsState(read: { data: Debtors | undefined; isError: boolean }): DebtorsState {
  if (read.data !== undefined) return 'ready'
  return read.isError ? 'failed' : 'pending'
}

export type CustomersView = 'flat' | CustomerSegment

/** The flat list for a typed query, for the window where a cleared query still shows the old answer, and for a failed read. */
export function customersView(input: {
  query: string
  isPlaceholderData: boolean
  debtors: DebtorsState
  segment: CustomerSegment
}): CustomersView {
  if (input.query !== '' || input.isPlaceholderData || input.debtors === 'failed') return 'flat'
  return input.segment
}

/**
 * The props `CustomerSegments` takes for a debtors answer: counts only from data, the skeleton
 * otherwise. The merged control takes `customerCount`, `debtorCount` and `pending`, not a single
 * `counts`, and the control's file is not this task's to change; this maps one to the other.
 */
export function segmentCounts(data: Debtors | undefined): {
  customerCount: number
  debtorCount: number
  pending: boolean
} {
  if (data === undefined) return { customerCount: 0, debtorCount: 0, pending: true }
  return { customerCount: data.customer_count, debtorCount: data.debtor_count, pending: false }
}

export const CustomerSearchContext = createContext<CustomerSearchValue | null>(null)

export function useCustomerSearch(): CustomerSearchValue {
  const value = useContext(CustomerSearchContext)
  if (value === null) {
    throw new Error('useCustomerSearch used outside the /clientes layout route')
  }
  return value
}
