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

import { useQuery } from '@tanstack/react-query'
import { createContext, useContext } from 'react'
import type { CUSTOMER_SEGMENTS, FixedValue } from '../../components/fixedSets'
import { debtorsQuery, type Debtors } from '../../api/payments'

export type CustomerSegment = FixedValue<typeof CUSTOMER_SEGMENTS>

export interface CustomerSearchValue {
  query: string
  setQuery: (query: string) => void
  segment: CustomerSegment
  setSegment: (segment: CustomerSegment) => void
}

export type DebtorsState = 'pending' | 'ready' | 'failed'

/**
 * `failed` when the latest read errored (even with older data, which is then never shown) or when
 * there is no data and an error time exists: TanStack puts a no-data retry back to `pending` with
 * `error` null, but `errorUpdatedAt` survives. `ready` is data with no error; `pending` otherwise.
 */
export function debtorsState(read: {
  data: Debtors | undefined
  isError: boolean
  errorUpdatedAt: number
}): DebtorsState {
  if (read.isError || (read.data === undefined && read.errorUpdatedAt > 0)) return 'failed'
  return read.data !== undefined ? 'ready' : 'pending'
}

export interface DebtorsRead {
  state: DebtorsState
  /** The answer, non-null only when `state` is `ready`: every figure Customers draws comes from here. */
  data: Debtors | null
  /** A retry is in flight on a failed read. */
  busy: boolean
  /** Any fetch of the debtors query is in flight, first read or refresh. */
  fetching: boolean
  errorUpdatedAt: number
  /** Re-reads the debtors only, never the customer list; nothing while a retry is in flight. */
  retry: () => void
}

/** The one reading of the debtors query in Customers. */
export function useDebtors(): DebtorsRead {
  const { data, isError, errorUpdatedAt, fetchStatus, isFetching, refetch } = useQuery(debtorsQuery)
  const state = debtorsState({ data, isError, errorUpdatedAt })
  const busy = state === 'failed' && fetchStatus === 'fetching'
  return {
    state,
    data: state === 'ready' && data !== undefined ? data : null,
    busy,
    fetching: isFetching,
    errorUpdatedAt,
    retry: () => {
      if (busy) return
      void refetch({ cancelRefetch: false })
    },
  }
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
export function segmentCounts(data: Debtors | null): {
  customerCount: number
  debtorCount: number
  pending: boolean
} {
  if (data === null) return { customerCount: 0, debtorCount: 0, pending: true }
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
