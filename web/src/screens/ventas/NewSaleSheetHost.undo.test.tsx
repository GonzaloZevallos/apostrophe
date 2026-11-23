/**
 * `NewSaleSheetHost` (unrouted) announcing its saved Sale, at the plan's seam: the host mounted in a memory
 * data router under `FlashProvider`, `fetch` faked and the clock fake. The hook's own cases (outcomes, 401,
 * refreshes) are in `useUndoSale.flow.test.tsx`; here the host's wiring and the races between two Sales.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outlet, createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import ContentArea from '../../components/ContentArea'
import { inAppState } from '../../components/inAppState'
import { SheetRouterProvider } from '../../components/useSheetStack'
import FlashProvider, { DEFAULT_TOAST_MS, SALE_SAVED_TOAST_MS } from '../../flash/FlashProvider'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import { SALE_NEW, SALES } from '../../routes'
import { METHODS_ANSWER } from '../../test-payment-methods'
import NewSaleSheetHost, { type NewSaleSheetHostProps } from './NewSaleSheetHost'
import { FORMAT, PRODUCTS, TODAY } from './renderNuevaVentaSheet'

const ME: Me = { email: 'a@b.c', business_name: 'Shop', today: TODAY, shown_language: 'en', money: FORMAT } as Me

const ANA = {
  id: 5,
  name: 'Ana',
  phone: null,
  phone_display: null,
  vip: false,
  customer_type_id: null,
  balance: 0,
  owing_since: null,
  standing: 'ok',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** Each saved Sale gets the next id; its DELETE answers what `answers` holds for that id, or is held. */
let nextSaleId: number
let deletes: string[]
let held: Map<string, (response: Response) => void>
let immediate: Map<string, Response>

function stubFetch(): void {
  nextSaleId = 55
  deletes = []
  held = new Map()
  immediate = new Map()
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url === SALES && init?.method === 'POST') {
        const id = nextSaleId
        nextSaleId += 1
        return Promise.resolve(json(201, { id }))
      }
      if (url.startsWith(`${SALES}/`) && init?.method === 'DELETE') {
        const id = url.slice(SALES.length + 1)
        deletes.push(id)
        const answer = immediate.get(id)
        if (answer !== undefined) return Promise.resolve(answer.clone())
        return new Promise<Response>((resolve) => held.set(id, resolve))
      }
      if (url === '/pricing-settings') return Promise.resolve(json(200, { is_bulk_pricing: true, is_vip_customers: false }))
      if (url === '/stock') return Promise.resolve(json(200, { total: 0, entries: [], products: [] }))
      if (url.startsWith('/api/sales/suggestions')) {
        return Promise.resolve(json(200, { recent_customer_ids: [], most_sold_product_ids: [1, 2, 3], last_payment_method_id: null }))
      }
      if (url.startsWith('/api/products')) return Promise.resolve(json(200, PRODUCTS))
      if (url === '/api/payment-methods') return Promise.resolve(json(200, METHODS_ANSWER))
      if (url === '/api/customer-types') return Promise.resolve(json(200, []))
      if (url.startsWith('/customers')) return Promise.resolve(json(200, [ANA]))
      return Promise.resolve(json(404, {}))
    }),
  )
}

const OTHER = '/elsewhere'
const IN_APP = [SALES, { pathname: SALE_NEW, state: inAppState({ pathname: SALES }) }] as const

interface Mounted {
  router: ReturnType<typeof createMemoryRouter>
  user: ReturnType<typeof userEvent.setup>
}

function mount({ onSaved }: { onSaved?: NewSaleSheetHostProps['onSaved'] } = {}): Mounted {
  stubFetch()
  const router = createMemoryRouter(
    [
      {
        element: (
          <FlashProvider>
            <Outlet />
          </FlashProvider>
        ),
        children: [
          {
            path: SALES,
            element: (
              <ContentArea as="main">
                <h1>Sales list</h1>
              </ContentArea>
            ),
          },
          {
            path: OTHER,
            element: (
              <ContentArea as="main">
                <h1>Elsewhere</h1>
              </ContentArea>
            ),
          },
          {
            element: <Outlet context={ME} />,
            children: [{ path: SALE_NEW, element: <NewSaleSheetHost onSaved={onSaved} /> }],
          },
        ],
      },
    ],
    { initialEntries: [...IN_APP] as never, initialIndex: IN_APP.length - 1 },
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MoneyFormatProvider format={FORMAT}>
        <SheetRouterProvider router={router}>
          <RouterProvider router={router} />
        </SheetRouterProvider>
      </MoneyFormatProvider>
    </QueryClientProvider>,
  )
  return { router, user: userEvent.setup({ advanceTimers: vi.advanceTimersByTime }) }
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-11-19T12:00:00Z'), shouldAdvanceTime: true })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const sheet = () => screen.getByRole('dialog', { name: 'New sale' })
const path = (m: Mounted) => m.router.state.location.pathname
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

async function chooseAna(m: Mounted): Promise<void> {
  await m.user.click(await within(sheet()).findByRole('button', { name: 'Change' }))
  await screen.findByText('Ana')
  await m.user.click(screen.getByRole('button', { name: /Ana/ }))
  await waitFor(() => expect(within(sheet()).getByText('Ana')).toBeInTheDocument())
}

/** A line, Collect, Cash and the save; resolves once the save was tapped. */
async function saveWithLine(m: Mounted): Promise<void> {
  await m.user.click(await screen.findByRole('button', { name: 'Add Rosa' }))
  await m.user.click(await screen.findByRole('button', { name: 'Collect' }))
  await screen.findByRole('dialog', { name: /^The sale/ })
  await m.user.click(await screen.findByRole('button', { name: /^How they pay/ }))
  await m.user.click(await screen.findByRole('button', { name: 'Cash' }))
  await m.user.click(within(screen.getByRole('dialog', { name: /^The sale/ })).getByRole('button', { name: /^Collect/ }))
}

/** Saves a Sale from the list's New sale and waits for the destination to hold its toast. */
async function saveFromList(m: Mounted): Promise<void> {
  await saveWithLine(m)
  await waitFor(() => expect(path(m)).toBe(SALES))
  await screen.findByRole('button', { name: 'Undo' })
}

async function openNewSale(m: Mounted): Promise<void> {
  await act(() => m.router.navigate(SALE_NEW, { state: inAppState({ pathname: SALES }) }))
  await screen.findByRole('dialog', { name: 'New sale' })
}

describe('the saved toast', () => {
  test('is on the destination with its Undo at 4.9 s and gone at 5 s, named after the customer', async () => {
    const m = mount()
    await chooseAna(m)
    await saveFromList(m)

    expect(screen.getByRole('heading', { name: 'Sales list' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Sale to Ana saved')
    advance(SALE_SAVED_TOAST_MS - 100)
    expect(screen.getByRole('status')).toHaveTextContent('Sale to Ana saved')
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
    advance(100)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  test('with no customer uses the No customer text', async () => {
    const m = mount()
    await saveFromList(m)

    expect(screen.getByRole('status')).toHaveTextContent('Sale to No customer saved')
  })

  test('is never raised for a caller that owns its exit with onSaved, even after a later navigation', async () => {
    const onSaved = vi.fn<NonNullable<NewSaleSheetHostProps['onSaved']>>()
    const m = mount({ onSaved })
    await saveWithLine(m)
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(55, null))
    expect(screen.queryByText(/^Sale to/)).not.toBeInTheDocument()

    // The host stays open with its lines, so the leave guard asks before the route changes.
    await act(() => m.router.navigate(OTHER))
    await m.user.click(await screen.findByRole('button', { name: 'Yes, discard it' }))
    expect(await screen.findByRole('heading', { name: 'Elsewhere' })).toBeInTheDocument()
    expect(screen.queryByText(/^Sale to/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })
})

describe('Undo through the host', () => {
  test('sends one DELETE for the saved Sale and shows that it was deleted', async () => {
    const m = mount()
    immediate.set('55', json(200, { returned: [] }))
    await saveFromList(m)

    await m.user.click(screen.getByRole('button', { name: 'Undo' }))

    expect(await screen.findByText(/Sale deleted/)).toBeInTheDocument()
    expect(deletes).toEqual(['55'])
  })
})

describe('two Sales and a slow DELETE', () => {
  test('a late result of A never replaces the toast of B; it shows after B ends', async () => {
    const m = mount()
    await saveFromList(m)
    await m.user.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(held.has('55')).toBe(true))

    await openNewSale(m)
    await saveFromList(m)
    expect(screen.getByRole('status')).toHaveTextContent('Sale to No customer saved')

    advance(1000)
    await act(async () => held.get('55')?.(json(200, { returned: [] })))
    advance(SALE_SAVED_TOAST_MS - 1000 - 100)
    expect(screen.getByRole('status')).toHaveTextContent('Sale to No customer saved')
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
    expect(screen.queryByText(/Sale deleted/)).not.toBeInTheDocument()

    advance(100)
    expect(await screen.findByText(/Sale deleted/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })

  test('a failure of A that arrived behind B shows first, and the deleted of B only after it ends', async () => {
    const m = mount()
    await saveFromList(m)
    await m.user.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(held.has('55')).toBe(true))

    await openNewSale(m)
    await saveFromList(m)
    await act(async () => held.get('55')?.(json(500, { code: 'server.broken' })))
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()

    await m.user.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(held.has('56')).toBe(true))
    await act(async () => held.get('56')?.(json(200, { returned: [] })))

    expect(await screen.findByText(/The sale is still saved\. Delete it from its detail in Sales\./)).toBeInTheDocument()
    expect(screen.queryByText(/Sale deleted/)).not.toBeInTheDocument()
    advance(DEFAULT_TOAST_MS)
    expect(await screen.findByText(/Sale deleted/)).toBeInTheDocument()
    expect(screen.queryByText(/The sale is still saved\. Delete it from its detail in Sales\./)).not.toBeInTheDocument()
    expect(deletes).toEqual(['55', '56'])
  })

  test('a DELETE held past 5 s and a navigation shows its result once, and the next navigation clears it', async () => {
    const m = mount()
    await saveFromList(m)
    await m.user.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(held.has('55')).toBe(true))

    advance(SALE_SAVED_TOAST_MS + 1000)
    await act(() => m.router.navigate(OTHER))
    expect(await screen.findByRole('heading', { name: 'Elsewhere' })).toBeInTheDocument()
    expect(screen.queryByText(/Sale deleted/)).not.toBeInTheDocument()

    await act(async () => held.get('55')?.(json(200, { returned: [] })))
    expect(await screen.findAllByText(/Sale deleted/)).toHaveLength(1)
    expect(path(m)).toBe(OTHER)

    await act(() => m.router.navigate(SALES))
    await waitFor(() => expect(screen.queryByText(/Sale deleted/)).not.toBeInTheDocument())
    expect(deletes).toEqual(['55'])
  })
})
