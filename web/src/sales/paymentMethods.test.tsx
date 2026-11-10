/**
 * The Payment method options a Selector draws: the business's active methods as the API lists
 * them, in that order, each option's value the id as text, loading while the query is pending.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { paymentMethodsResponse } from '../test/paymentMethods'
import { paymentMethodIdOf, usePaymentMethodOptions } from './paymentMethods'

afterEach(() => vi.unstubAllGlobals())

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

test('the hook lists the API methods in order, loading first, with the id as the value', async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(paymentMethodsResponse())))
  const { result } = renderHook(() => usePaymentMethodOptions(), { wrapper })
  expect(result.current.loading).toBe(true)
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.required).toBe(true)
  expect(result.current.options).toEqual([
    { value: '1', label: 'Cash' },
    { value: '2', label: 'Transfer' },
    { value: '3', label: 'Mercado Pago' },
  ])
})

test('a value that is not a method id is never taken for one', () => {
  expect(paymentMethodIdOf('2')).toBe(2)
  expect(paymentMethodIdOf(null)).toBeNull()
  expect(paymentMethodIdOf('cash')).toBeNull()
  expect(paymentMethodIdOf('2x')).toBeNull()
  expect(paymentMethodIdOf('')).toBeNull()
})
