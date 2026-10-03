/**
 * The search query the `/clientes` layout route holds (plan, "Search"): a React
 * context, never the URL and never storage, so it survives going from the list to
 * a card or a form and back without ever naming a business or a customer in a
 * link.
 */

import { createContext, useContext } from 'react'

export interface CustomerSearchValue {
  query: string
  setQuery: (query: string) => void
}

export const CustomerSearchContext = createContext<CustomerSearchValue | null>(null)

export function useCustomerSearch(): CustomerSearchValue {
  const value = useContext(CustomerSearchContext)
  if (value === null) {
    throw new Error('useCustomerSearch used outside the /clientes layout route')
  }
  return value
}
