/**
 * `useNewSalePricing` at its seam: `renderHook`, `fetch` faked as `renderNuevaVentaSheet` does, shipping
 * '0'. The names map keeps a product's name when a later date's answer leaves it out.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { keys } from '../api/keys'
import { MoneyFormatProvider } from '../format/MoneyFormatProvider'
import type { Variety } from '../screens/Variedades'
import { collectStateOf } from './newSalePricing'
import type { CustomerView } from './newSaleView'
import { draftLineOf, initialDraft, type DraftState } from './saleDraft'
import { useNewSalePricing } from './useNewSalePricing'

const TODAY = '2026-10-02'
const OTHER_DAY = '2026-09-28'
const FORMAT = { symbol: '$', decimals: 0 }
const NONE: CustomerView = { kind: 'none' }
const price = { id: 1, effective_from: '2026-09-01', list_price: 1000, bulk_price: null, bulk_minimum: null, vip_price: null }
const product = (id: number, name: string): Variety => ({ id, name, archived: false, current_price: price })

const TODAY_PRODUCTS = [product(1, 'Rosa'), product(2, 'Árbol'), product(3, 'Cedro')]

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

/** Answers every read; the Products of `heldDate` wait for `release`, and `answers` says what each date lists. */
function fakeFetch(answers: Record<string, Variety[]>, heldDate: string | null) {
  let release: () => void = () => undefined
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost')
      if (url.pathname === '/api/products') {
        const date = url.searchParams.get('on') ?? ''
        const answer = json(answers[date] ?? [])
        if (date === heldDate) {
          return new Promise<Response>((resolve) => {
            release = () => resolve(answer)
          })
        }
        return Promise.resolve(answer)
      }
      if (url.pathname === '/pricing-settings') return Promise.resolve(json({ is_bulk_pricing: true, is_vip_customers: true }))
      if (url.pathname === '/stock') return Promise.resolve(json({ total: 0, entries: [], products: [] }))
      if (url.pathname.startsWith('/api/sales/suggestions')) {
        return Promise.resolve(json({ recent_customer_ids: [], most_sold_product_ids: [1, 2, 3], last_payment_method_id: null }))
      }
      return Promise.resolve(new Response('{}', { status: 404 }))
    }),
  )
  return { release: () => act(() => release()) }
}

function wrapperOf(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MoneyFormatProvider format={FORMAT}>{children}</MoneyFormatProvider>
      </QueryClientProvider>
    )
  }
}

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

function stateOf(overrides: Partial<DraftState> = {}): DraftState {
  return { ...initialDraft({ today: TODAY }), lines: [draftLineOf(1, 100), draftLineOf(3, 100)], shipping: '0', ...overrides }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('names', () => {
  test('a date whose answer omits a product, held then released, still names it', async () => {
    const gate = fakeFetch({ [TODAY]: TODAY_PRODUCTS, [OTHER_DAY]: [product(1, 'Rosa'), product(2, 'Árbol')] }, OTHER_DAY)
    const { result, rerender } = renderHook(({ state }) => useNewSalePricing({ state, customer: NONE }), {
      initialProps: { state: stateOf() },
      wrapper: wrapperOf(newClient()),
    })
    await waitFor(() => expect(result.current.reads.status).toBe('ready'))
    expect(result.current.nameOf(3)).toBe('Cedro')

    rerender({ state: stateOf({ date: OTHER_DAY }) })
    await waitFor(() => expect(result.current.reads.status).toBe('refreshing'))
    expect(result.current.nameOf(3)).toBe('Cedro')

    gate.release()
    await waitFor(() => expect(result.current.reads.status).toBe('ready'))
    expect(result.current.reads.products?.map((p) => p.id)).toEqual([1, 2])
    expect(result.current.nameOf(3)).toBe('Cedro')
  })

  test('an answer that renames product 2 and omits 3 gives the new name for 2 and the old one for 3', async () => {
    const gate = fakeFetch({ [TODAY]: TODAY_PRODUCTS, [OTHER_DAY]: [product(1, 'Rosa'), product(2, 'Árbol nuevo')] }, OTHER_DAY)
    const { result, rerender } = renderHook(({ state }) => useNewSalePricing({ state, customer: NONE }), {
      initialProps: { state: stateOf() },
      wrapper: wrapperOf(newClient()),
    })
    await waitFor(() => expect(result.current.reads.status).toBe('ready'))
    rerender({ state: stateOf({ date: OTHER_DAY }) })
    await waitFor(() => expect(result.current.reads.status).toBe('refreshing'))
    gate.release()
    await waitFor(() => expect(result.current.reads.status).toBe('ready'))
    expect(result.current.nameOf(2)).toBe('Árbol nuevo')
    expect(result.current.nameOf(3)).toBe('Cedro')
  })

  test('a rerender with no new answer keeps the identity of nameOf', async () => {
    fakeFetch({ [TODAY]: TODAY_PRODUCTS }, null)
    const { result, rerender } = renderHook(({ state }) => useNewSalePricing({ state, customer: NONE }), {
      initialProps: { state: stateOf() },
      wrapper: wrapperOf(newClient()),
    })
    await waitFor(() => expect(result.current.reads.status).toBe('ready'))
    const before = result.current.nameOf
    rerender({ state: stateOf({ lines: [draftLineOf(2, 100)] }) })
    expect(result.current.nameOf).toBe(before)
  })

  test('nameOf of an unseen id throws, with no id in the message', async () => {
    fakeFetch({ [TODAY]: TODAY_PRODUCTS }, null)
    const { result } = renderHook(() => useNewSalePricing({ state: stateOf(), customer: NONE }), {
      wrapper: wrapperOf(newClient()),
    })
    await waitFor(() => expect(result.current.reads.status).toBe('ready'))
    expect(() => result.current.nameOf(99)).toThrow(new Error('no name for product'))
  })
})

describe('with every read already cached', () => {
  test('an empty shipping is not ready on the first render, and shipping 0 reaches ready', async () => {
    fakeFetch({ [TODAY]: TODAY_PRODUCTS }, null)
    const client = newClient()
    client.setQueryData(keys.saleFormVarieties(TODAY), TODAY_PRODUCTS)
    client.setQueryData(keys.saleFormPricingSettings(TODAY), { is_bulk_pricing: true, is_vip_customers: true })
    client.setQueryData(keys.saleFormSuggestions(TODAY), {
      recent_customer_ids: [],
      most_sold_product_ids: [1, 2, 3],
      last_payment_method_id: null,
    })
    client.setQueryData(keys.stock(), { total: 0, entries: [], products: [] })
    const states: string[] = []
    const { result, rerender } = renderHook(
      ({ state }) => {
        const source = useNewSalePricing({ state, customer: NONE })
        const collect = collectStateOf(source.pricing, source.nameOf)
        states.push(collect.kind)
        return { ...source, collect }
      },
      { initialProps: { state: stateOf({ shipping: '' }) }, wrapper: wrapperOf(client) },
    )
    expect(states[0]).not.toBe('ready')
    expect(result.current.collect.kind).toBe('shippingInvalid')

    rerender({ state: stateOf({ shipping: '0' }) })
    expect(result.current.collect.kind).toBe('ready')
  })
})
