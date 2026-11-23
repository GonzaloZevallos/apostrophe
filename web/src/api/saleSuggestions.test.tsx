import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ApiError } from './client'
import { keys } from './keys'
import { EMPTY_SUGGESTIONS, SUGGESTIONS_KEYS, useSaleSuggestions } from './saleSuggestions'

const BODY = {
  recent_customer_ids: [3, 1],
  most_sold_product_ids: [8],
  last_payment_method_id: 5,
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const onError = vi.fn()
let client: QueryClient
const fetchMock = vi.fn()

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  onError.mockReset()
  fetchMock.mockReset()
  client = new QueryClient({ queryCache: new QueryCache({ onError }) })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('one call per mount with on = the opening date, and rerenders make no new call', async () => {
  fetchMock.mockImplementation(() => Promise.resolve(json(BODY)))
  const { result, rerender } = renderHook((props: { openedOn: string }) => useSaleSuggestions(props.openedOn), {
    wrapper,
    initialProps: { openedOn: '2026-11-19' },
  })
  await waitFor(() => expect(result.current).toEqual(BODY))
  rerender({ openedOn: '2026-11-19' })
  rerender({ openedOn: '2026-11-19' })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/sales/suggestions?on=2026-11-19')
})

test('null while the read is pending, then the data, and never null again on a rerender', async () => {
  let answer: (response: Response) => void = () => undefined
  fetchMock.mockImplementation(() => new Promise<Response>((resolve) => (answer = resolve)))
  const { result, rerender } = renderHook((props: { openedOn: string }) => useSaleSuggestions(props.openedOn), {
    wrapper,
    initialProps: { openedOn: '2026-11-19' },
  })
  expect(result.current).toBeNull()
  rerender({ openedOn: '2026-11-19' })
  expect(result.current).toBeNull()
  answer(json(BODY))
  await waitFor(() => expect(result.current).toEqual(BODY))
  rerender({ openedOn: '2026-11-19' })
  expect(result.current).toEqual(BODY)
})

test('the key is the opening date only, in the frozen sale-form shape', () => {
  expect(keys.saleFormSuggestions('2026-11-19')).toEqual(['sale-form', 'suggestions', '2026-11-19'])
})

test('unmounting and opening again on another day makes one new call with the new date', async () => {
  fetchMock.mockImplementation(() => Promise.resolve(json(BODY)))
  const first = renderHook(() => useSaleSuggestions('2026-11-19'), { wrapper })
  await waitFor(() => expect(first.result.current).toEqual(BODY))
  first.unmount()
  const second = renderHook(() => useSaleSuggestions('2026-11-20'), { wrapper })
  await waitFor(() => expect(second.result.current).toEqual(BODY))
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/sales/suggestions?on=2026-11-20')
})

test('a 401 settles to no suggestions, not null, and reaches the cache error handler as an ApiError 401', async () => {
  fetchMock.mockImplementation(() => Promise.resolve(json({ code: 'unauthenticated' }, 401)))
  const { result } = renderHook(() => useSaleSuggestions('2026-11-19'), { wrapper })
  await waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(result.current).not.toBeNull())
  const error: unknown = onError.mock.calls[0]?.[0]
  expect(error).toBeInstanceOf(ApiError)
  expect((error as ApiError).status).toBe(401)
  expect(result.current).toEqual(EMPTY_SUGGESTIONS)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test.each([
  ['a 422', () => json({ code: 'RequestInvalid' }, 422)],
  ['a 500', () => json({}, 500)],
  [
    'a malformed body',
    () => json({ recent_customer_ids: ['a'], most_sold_product_ids: [], last_payment_method_id: null }),
  ],
  ['a body that is not an object', () => json(null)],
  ['a non-integer method id', () => json({ ...BODY, last_payment_method_id: 1.5 })],
])('%s gives no suggestions, silently', async (_name, answer) => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  fetchMock.mockImplementation(() => Promise.resolve(answer()))
  const { result } = renderHook(() => useSaleSuggestions('2026-11-19'), { wrapper })
  await waitFor(() =>
    expect(client.getQueryState(keys.saleFormSuggestions('2026-11-19'))?.status).toBe('success'),
  )
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(result.current).toEqual(EMPTY_SUGGESTIONS)
  expect(onError).not.toHaveBeenCalled()
  expect(consoleError).not.toHaveBeenCalled()
})

test('a network error gives no suggestions, silently', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
  const { result } = renderHook(() => useSaleSuggestions('2026-11-19'), { wrapper })
  await waitFor(() =>
    expect(client.getQueryState(keys.saleFormSuggestions('2026-11-19'))?.status).toBe('success'),
  )
  expect(result.current).toEqual(EMPTY_SUGGESTIONS)
  expect(onError).not.toHaveBeenCalled()
  expect(consoleError).not.toHaveBeenCalled()
})

interface Schema {
  properties?: Record<string, unknown>
}
const snapshot = JSON.parse(
  readFileSync(resolve(__dirname, '../../../tests/fixtures/openapi_snapshot.json'), 'utf8'),
) as { components: { schemas: Record<string, Schema> } }

function sameSet(front: readonly string[], server: readonly string[]): boolean {
  const left = [...front].sort()
  const right = [...server].sort()
  return left.length === right.length && left.every((value, index) => value === right[index])
}

test('SUGGESTIONS_KEYS equal the properties of SuggestionsOut in the OpenAPI snapshot', () => {
  const server = Object.keys(snapshot.components.schemas.SuggestionsOut?.properties ?? {})
  expect(sameSet(SUGGESTIONS_KEYS, server)).toBe(true)
  // the comparison rejects a drifted list
  expect(sameSet(['recent_customer_ids', 'most_sold_product_ids'], server)).toBe(false)
  expect(sameSet([...SUGGESTIONS_KEYS, 'limit'], server)).toBe(false)
})
