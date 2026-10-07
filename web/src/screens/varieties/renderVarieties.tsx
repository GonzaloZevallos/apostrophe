/**
 * Test harness for a variety's price screens: the real data router with the gated
 * layout's flash provider, the three routes mounted as `router.tsx` mounts them, a
 * stand-in for a variety's page (built by another subtask), and `fetch` faked.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { Link, Outlet, RouterProvider, createMemoryRouter } from 'react-router'
import { vi } from 'vitest'
import type { Me } from '../../api/me'
import FlashProvider from '../../flash/FlashProvider'
import { VARIETIES, relative } from '../../routes'
import { VARIETY, VARIETY_PRICES, VARIETY_PRICE_NEW } from '../../legacyVarietyPaths'
import PriceHistory from './PriceHistory'
import PriceNew from './PriceNew'
import VarietyRoute from './VarietyRoute'

export const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }

export const VARIETY_ROW = {
  id: 1,
  name: '24K Gold',
  current_price: { id: 3, effective_from: '2026-09-25', list_price: 11000, bulk_price: 10000, bulk_minimum: 10 },
}

export const HISTORY = [
  { id: 3, effective_from: '2026-09-25', list_price: 11000, bulk_price: 10000, bulk_minimum: 10 },
  { id: 2, effective_from: '2026-09-01', list_price: 10500, bulk_price: null, bulk_minimum: null },
  { id: 1, effective_from: '2026-07-05', list_price: 9800, bulk_price: null, bulk_minimum: null },
]

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>

/** The faked API for variety 1: `overrides` replaces any one of its answers. */
export function api(overrides: Record<string, () => Response> = {}): FetchImpl {
  return (url, init) => {
    const key = `${init?.method ?? 'GET'} ${url}`
    const override = overrides[key]
    if (override !== undefined) return Promise.resolve(override())
    if (key === 'GET /varieties/1') return Promise.resolve(jsonResponse(200, VARIETY_ROW))
    if (key === 'GET /varieties/1/prices') return Promise.resolve(jsonResponse(200, HISTORY))
    return Promise.reject(new Error(`unexpected request: ${key}`))
  }
}

/** Renders the app at `initialEntries` (the last one is current). */
export function renderVarieties(initialEntries: string[], fetchImpl: FetchImpl) {
  const fetchMock = vi.fn(fetchImpl)
  vi.stubGlobal('fetch', fetchMock)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      {
        element: (
          <QueryClientProvider client={queryClient}>
            <FlashProvider>
              <Outlet context={ME} />
            </FlashProvider>
          </QueryClientProvider>
        ),
        children: [
          {
            path: relative(VARIETIES),
            element: <main>Pantalla Variedades</main>,
          },
          {
            path: relative(VARIETY(':id')),
            element: (
              <main>
                <span>Página de la variedad</span>
                <Link to={VARIETY_PRICES(1)}>Ver todos los precios</Link>
                <Link to={VARIETY_PRICE_NEW(1)}>Nuevo precio</Link>
              </main>
            ),
          },
          {
            path: relative(VARIETY_PRICES(':id')),
            element: <VarietyRoute render={(varietyId) => <PriceHistory varietyId={varietyId} />} />,
          },
          {
            path: relative(VARIETY_PRICE_NEW(':id')),
            element: <VarietyRoute render={(varietyId) => <PriceNew varietyId={varietyId} />} />,
          },
        ],
      },
    ],
    { initialEntries, initialIndex: initialEntries.length - 1 },
  )
  render(<RouterProvider router={router} />)
  return { router, queryClient, fetchMock }
}

/** The requests that changed something, in order: `METHOD path` and the parsed body. */
export function writes(fetchMock: ReturnType<typeof vi.fn>): { call: string; body: unknown }[] {
  return fetchMock.mock.calls
    .map(([url, init]) => ({ url: url as string, init: init as RequestInit | undefined }))
    .filter(({ init }) => init?.method !== undefined && init.method !== 'GET')
    .map(({ url, init }) => ({
      call: `${init?.method} ${url}`,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    }))
}
