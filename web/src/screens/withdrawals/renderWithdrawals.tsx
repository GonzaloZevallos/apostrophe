/**
 * Test harness for the withdrawal screens: the real data router (`createMemoryRouter`) with
 * the flash provider, `Shell`, Variedades and the withdrawal routes mounted as `router.tsx`
 * mounts them, and `fetch` faked at the network (never the API client).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router'
import { vi } from 'vitest'
import type { Me } from '../../api/me'
import type { ShownLanguage } from '../../api/language'
import FlashProvider from '../../flash/FlashProvider'
import { VARIETIES as VARIETIES_PATH, WITHDRAWAL, WITHDRAWAL_EDIT, WITHDRAWAL_NEW, relative } from '../../routes'
import Shell from '../../shell/Shell'
import Variedades from '../Variedades'
import WithdrawalDetail from './WithdrawalDetail'
import WithdrawalFormRoute from './WithdrawalFormRoute'

export const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-06', shown_language: 'en' as ShownLanguage }

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>

export const VARIETIES = [
  { id: 1, name: 'Zkittlez', current_price: null },
  { id: 2, name: 'Gelato', current_price: null },
]

export const STOCK = { total: 0, products: [], entries: [] }

/** Answers the reads every screen here makes; `rest` answers the rest (writes, the withdrawal). */
export function withReads(
  rest: FetchImpl,
  varieties?: () => Promise<Response>,
  stock: unknown = STOCK,
): FetchImpl {
  return async (url, init) => {
    if (url === '/api/products') return varieties === undefined ? jsonResponse(200, VARIETIES) : varieties()
    if (url === '/stock') return jsonResponse(200, stock)
    return rest(url, init)
  }
}

/** `varieties` answers `GET /api/products` when a test needs the list to change over time; `stock` is what `GET /stock` holds. */
export function renderWithdrawals(
  initialEntries: string[],
  fetchImpl: FetchImpl,
  varieties?: () => Promise<Response>,
  stock?: unknown,
) {
  const fetchMock = vi.fn(withReads(fetchImpl, varieties, stock))
  vi.stubGlobal('fetch', fetchMock)
  const router = createMemoryRouter(
    [
      {
        element: (
          <FlashProvider>
            <Outlet context={ME} />
          </FlashProvider>
        ),
        children: [
          {
            element: <Shell />,
            children: [
              { path: relative(VARIETIES_PATH), element: <Variedades />, handle: { screen: 'varieties' } },
              {
                path: relative(WITHDRAWAL_NEW),
                element: <WithdrawalFormRoute mode="new" />,
                handle: { screen: 'withdrawal-new' },
              },
              {
                path: relative(WITHDRAWAL_EDIT),
                element: <WithdrawalFormRoute mode="edit" />,
                handle: { screen: 'withdrawal-edit' },
              },
              {
                path: relative(WITHDRAWAL),
                element: <WithdrawalDetail />,
                handle: { screen: 'withdrawal' },
              },
            ],
          },
        ],
      },
    ],
    { initialEntries, initialIndex: initialEntries.length - 1 },
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { router, fetchMock }
}
