/**
 * Test harness for a variety's price screens: the real data router with the gated
 * layout's flash provider, the three routes mounted as `router.tsx` mounts them, a
 * stand-in for a variety's page (built by another subtask), and `fetch` faked.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router'
import { vi } from 'vitest'
import type { Me } from '../../api/me'
import InAppLink from '../../components/InAppLink'
import FlashProvider from '../../flash/FlashProvider'
import {
  ARCHIVED_VARIETIES,
  VARIETIES,
  VARIETY,
  VARIETY_ENTRIES,
  VARIETY_PRICE_NEW,
  VARIETY_PRICES,
  pathTo,
  relative,
} from '../../routes'
import Shell from '../../shell/Shell'
import EntriesList from '../EntriesList'
import PriceHistory from './PriceHistory'
import PriceNew from './PriceNew'
import VarietyPage from './VarietyPage'
import VarietyRoute from './VarietyRoute'

export const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }

export const VARIETY_ROW = {
  id: 1,
  name: '24K Gold',
  current_price: { id: 3, effective_from: '2026-09-25', list_price: 11000, bulk_price: 10000, bulk_minimum: 10, vip_price: 9000 },
}

export const HISTORY = [
  { id: 3, effective_from: '2026-09-25', list_price: 11000, bulk_price: 10000, bulk_minimum: 10, vip_price: 9000 },
  { id: 2, effective_from: '2026-09-01', list_price: 10500, bulk_price: null, bulk_minimum: null, vip_price: null },
  { id: 1, effective_from: '2026-07-05', list_price: 9800, bulk_price: null, bulk_minimum: null, vip_price: null },
]

/** The switches `GET /pricing-settings` answers unless a test overrides them: both on. */
export const SETTINGS_ON = { is_bulk_pricing: true, is_vip_customers: true }

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
    if (key === 'GET /pricing-settings') return Promise.resolve(jsonResponse(200, SETTINGS_ON))
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
            path: relative(VARIETY),
            element: (
              <main>
                <span>Página de la variedad</span>
                <InAppLink to={pathTo(VARIETY_PRICES, { id: 1 })}>Ver todos los precios</InAppLink>
                <InAppLink to={pathTo(VARIETY_PRICE_NEW, { id: 1 })}>Nuevo precio</InAppLink>
              </main>
            ),
          },
          {
            path: relative(VARIETY_PRICES),
            element: <VarietyRoute render={(varietyId) => <PriceHistory varietyId={varietyId} />} />,
          },
          {
            path: relative(VARIETY_PRICE_NEW),
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

/** A `fetch` answer the test settles itself: `resolve` or `reject` it when the screen should see it. */
export function deferredAnswer(): {
  promise: Promise<Response>
  resolve: (response: Response) => void
  reject: (reason: Error) => void
} {
  let resolve: (response: Response) => void = () => undefined
  let reject: (reason: Error) => void = () => undefined
  const promise = new Promise<Response>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

/**
 * Renders a variety's page, its "Ver todas" lists and the two list screens (as stand-ins) under
 * the real `Shell`, each route carrying its registry `handle`, so the shell's chrome (the
 * "‹ parent" arrow) is what the test sees. `useViewport` is the test's to mock.
 */
export function renderVarietiesInShell(initialEntries: string[], fetchImpl: FetchImpl) {
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
            element: <Shell />,
            children: [
              { path: relative(VARIETIES), element: <main>Pantalla Variedades</main>, handle: { screen: 'varieties' } },
              {
                path: relative(ARCHIVED_VARIETIES),
                element: <main>Pantalla Archivadas</main>,
                handle: { screen: 'varieties-archived' },
              },
              {
                path: relative(VARIETY),
                element: <VarietyRoute render={(varietyId) => <VarietyPage varietyId={varietyId} />} />,
                handle: { screen: 'variety' },
              },
              {
                path: relative(VARIETY_PRICES),
                element: <VarietyRoute render={(varietyId) => <PriceHistory varietyId={varietyId} />} />,
                handle: { screen: 'variety-prices' },
              },
              {
                path: relative(VARIETY_ENTRIES),
                element: <VarietyRoute render={(varietyId) => <EntriesList varietyId={varietyId} />} />,
                handle: { screen: 'variety-entries' },
              },
            ],
          },
        ],
      },
    ],
    { initialEntries, initialIndex: initialEntries.length - 1 },
  )
  render(<RouterProvider router={router} />)
  return { router, queryClient, fetchMock }
}
