/**
 * The search query the /clientes layout route holds (plan, "Search"): a React
 * context, never the URL and never storage, so it survives going from the list to
 * a card or a form and back without ever naming a business or a customer in a
 * link. The selected segment (All | Owed to you) lives beside it, for the same reason: it
 * survives a trip to a card and back, and is never kept on the device, in the URL or on the server.
 * `setQuery` never writes it.
 *
 * `typedQuery`, `listKeyQuery`, `customersListState`, `debtorsState` and `customersView` are the
 * one decision of what Customers draws: they read which answers exist and the typed query, never
 * a count, a bucket or a money amount. The collapse and the list follow the typed `query`, not the
 * debounced value: a query of only spaces is no query, and a cleared one is the held segment at
 * once. The one query `useQuery` receives is `listKeyQuery`, so a clear keys the full list ('')
 * at once and "All" never shows the old query's matches as the full list.
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

/** The flat list for a typed query and for a failed debtors read; otherwise the held segment. */
export function customersView(input: {
  query: string
  debtors: DebtorsState
  segment: CustomerSegment
}): CustomersView {
  if (typedQuery(input.query) !== '' || input.debtors === 'failed') return 'flat'
  return input.segment
}

/** The query as the screen reads it: '' for no text or only spaces, otherwise exactly what was typed. */
export function typedQuery(query: string): string {
  return query.trim() === '' ? '' : query
}

/**
 * The only query the customers list read receives, for its key and its fetch: '' while nothing is
 * typed (a clear switches at once), otherwise the debounced value, '' when that is blank.
 */
export function listKeyQuery(query: string, debounced: string): string {
  if (typedQuery(query) === '') return ''
  return debounced.trim() === '' ? '' : debounced
}

export type CustomersListState = 'loading' | 'searching' | 'failed' | 'no-match' | 'empty' | 'rows'

/**
 * What the customers list draws, from the state of its read and never from a row's contents:
 * `rows` is the only state that draws a row. Under a typed query anything not yet the answer to
 * that exact query (the key behind it, pending, placeholder or fetching) is `searching`.
 */
export function customersListState(input: {
  typed: string
  keyQuery: string
  isPending: boolean
  isPlaceholderData: boolean
  isFetching: boolean
  isError: boolean
  isEmpty: boolean
}): CustomersListState {
  if (input.typed !== '') {
    if (input.keyQuery !== input.typed || input.isPending || input.isPlaceholderData || input.isFetching) {
      return 'searching'
    }
    if (input.isError) return 'failed'
    return input.isEmpty ? 'no-match' : 'rows'
  }
  if (input.isPending) return 'loading'
  if (input.isError) return 'failed'
  return input.isEmpty ? 'empty' : 'rows'
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
