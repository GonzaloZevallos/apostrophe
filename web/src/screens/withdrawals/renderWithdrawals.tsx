/**
 * Test harness for the withdrawal screens: the real data router (`createMemoryRouter`) with
 * the flash provider, `Shell`, Variedades and the withdrawal routes mounted as `router.tsx`
 * mounts them, and `fetch` faked at the network (never the API client).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router'
import { expect, vi } from 'vitest'
import type { Me } from '../../api/me'
import type { ShownLanguage } from '../../api/language'
import FlashProvider from '../../flash/FlashProvider'
import { VARIETIES as VARIETIES_PATH, WITHDRAWAL, WITHDRAWAL_EDIT, WITHDRAWAL_NEW, relative } from '../../routes'
import { SheetRouterProvider } from '../../components/useSheetStack'
import Shell from '../../shell/Shell'
import Variedades from '../Variedades'
import WithdrawalDetail from './WithdrawalDetail'
import WithdrawalFormRoute from './WithdrawalFormRoute'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'

export const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-06', shown_language: 'en' as ShownLanguage, money: { symbol: '$', decimals: 0 } }

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

/** The business's reasons as `GET /api/withdrawal-reasons` answers them, in its order. */
export const REASONS = [
  { id: 1, name: 'Marketing' },
  { id: 2, name: 'Own use' },
]

export const STOCK = { total: 0, products: [], entries: [] }

/** Answers the reads every screen here makes; `rest` answers the rest (writes, the withdrawal). */
export function withReads(
  rest: FetchImpl,
  varieties?: () => Promise<Response>,
  stock: unknown = STOCK,
  reasons?: () => Promise<Response>,
): FetchImpl {
  return async (url, init) => {
    if (url === '/api/withdrawal-reasons') return reasons === undefined ? jsonResponse(200, REASONS) : reasons()
    if (url === '/api/products') return varieties === undefined ? jsonResponse(200, VARIETIES) : varieties()
    if (url === '/stock') return jsonResponse(200, stock)
    return rest(url, init)
  }
}

/** `varieties` answers `GET /api/products` when a test needs the list to change over time; `stock` is what `GET /stock` holds; `reasons` answers `GET /api/withdrawal-reasons` the same way. */
export function renderWithdrawals(
  initialEntries: string[],
  fetchImpl: FetchImpl,
  varieties?: () => Promise<Response>,
  stock?: unknown,
  reasons?: () => Promise<Response>,
) {
  const fetchMock = vi.fn(withReads(fetchImpl, varieties, stock, reasons))
  vi.stubGlobal('fetch', fetchMock)
  const router = createMemoryRouter(
    [
      {
        element: (
          <FlashProvider>
            <MoneyFormatProvider format={ME.money}><Outlet context={ME} /></MoneyFormatProvider>
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
      <SheetRouterProvider router={router}>
        <RouterProvider router={router} />
      </SheetRouterProvider>
    </QueryClientProvider>,
  )
  return { router, fetchMock }
}

/** A Selector's field once it has loaded: a busy field is still waiting for its list. */
async function loadedField(name: RegExp): Promise<HTMLElement> {
  const field = await screen.findByRole('button', { name })
  await waitFor(() => expect(field).not.toHaveAttribute('aria-busy'))
  return field
}

/** The line's Variety field; a single line is "Variety", several are "Variety 1", "Variety 2". */
export function varietyField(position: number): Promise<HTMLElement> {
  return loadedField(position === 1 ? /^Product(?! [2-9])/ : new RegExp(`^Product ${position}`))
}

export function reasonField(): Promise<HTMLElement> {
  return loadedField(/^Reason/)
}

/** Opens a Selector's phone list and taps one option by its name. */
async function pickFrom(field: HTMLElement, name: string): Promise<void> {
  await userEvent.click(field)
  await userEvent.click(await screen.findByRole('button', { name }))
}

export async function pickVariety(position: number, name: string): Promise<void> {
  await pickFrom(await varietyField(position), name)
}

export async function pickReason(name: string): Promise<void> {
  await pickFrom(await reasonField(), name)
}
