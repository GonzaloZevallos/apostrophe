/**
 * `useDebtors` (CustomerSearch.ts) over a real QueryClient with `fetch` faked: the one reading of
 * the debtors query. A retry on a failed read is `failed` and `busy` while it is in flight, with or
 * without older data, and `retry` sends nothing while busy.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { debtorsOf } from '../../test/debtors'
import { useDebtors } from './CustomerSearch'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(() => useDebtors(), { wrapper })
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('a first read is pending, with no data and not busy, then ready with its data', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, debtorsOf()))
  const { result } = setup()

  expect(result.current).toMatchObject({ state: 'pending', data: null, busy: false })
  await waitFor(() => expect(result.current.state).toBe('ready'))
  expect(result.current.data).toEqual(debtorsOf())
})

test('after a failed first read, a retry in flight is failed and busy, and a second retry sends nothing', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(500, { detail: 'boom' }))
  const { result } = setup()
  await waitFor(() => expect(result.current.state).toBe('failed'))
  expect(result.current).toMatchObject({ data: null, busy: false })

  vi.mocked(fetch).mockImplementation(() => new Promise<Response>(() => {}))
  act(() => result.current.retry())
  await waitFor(() => expect(result.current.busy).toBe(true))
  expect(result.current.state).toBe('failed')
  expect(fetch).toHaveBeenCalledTimes(2)

  act(() => result.current.retry())
  expect(fetch).toHaveBeenCalledTimes(2)
})

test('a retry that answers is ready with its data and not busy', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(500, { detail: 'boom' }))
  const { result } = setup()
  await waitFor(() => expect(result.current.state).toBe('failed'))

  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, debtorsOf()))
  act(() => result.current.retry())

  await waitFor(() => expect(result.current.state).toBe('ready'))
  expect(result.current).toMatchObject({ busy: false, data: debtorsOf() })
})
