/**
 * Test harness for the withdrawal screens: the real data router (`createMemoryRouter`) with
 * the flash provider, `Shell`, Variedades and the withdrawal routes mounted as `router.tsx`
 * mounts them, and `fetch` faked at the network (never the API client).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configure, render } from '@testing-library/react'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router'
import { vi } from 'vitest'
import type { Me } from '../../api/me'
import FlashProvider from '../../flash/FlashProvider'
import { WITHDRAWAL, WITHDRAWAL_EDIT, WITHDRAWAL_NEW, relative } from '../../routes'
import Shell from '../../shell/Shell'
import Variedades from '../Variedades'
import WithdrawalDetail from './WithdrawalDetail'
import WithdrawalFormRoute from './WithdrawalFormRoute'

// A routed screen with several awaited reads is slow when the whole suite runs in parallel.
configure({ asyncUtilTimeout: 8000 })
vi.setConfig({ testTimeout: 30000 })

export const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-06' }

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

export const STOCK = { total: 0, varieties: [], entries: [] }

/** Answers the reads every screen here makes; `rest` answers the rest (writes, the withdrawal). */
export function withReads(rest: FetchImpl): FetchImpl {
  return async (url, init) => {
    if (url === '/varieties') return jsonResponse(200, VARIETIES)
    if (url === '/stock') return jsonResponse(200, STOCK)
    return rest(url, init)
  }
}

export function renderWithdrawals(initialEntries: string[], fetchImpl: FetchImpl) {
  const fetchMock = vi.fn(withReads(fetchImpl))
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
              { path: 'variedades', element: <Variedades /> },
              {
                path: relative(WITHDRAWAL_NEW),
                element: <WithdrawalFormRoute mode="new" />,
                handle: { chrome: 'none', tab: 'more' },
              },
              {
                path: relative(WITHDRAWAL_EDIT),
                element: <WithdrawalFormRoute mode="edit" />,
                handle: { chrome: 'none', tab: 'more' },
              },
              {
                path: relative(WITHDRAWAL),
                element: <WithdrawalDetail />,
                handle: { chrome: 'card' },
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
