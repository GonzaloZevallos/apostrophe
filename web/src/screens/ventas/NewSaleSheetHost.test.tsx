/**
 * `NewSaleSheetHost` (unrouted) at its seam: Testing Library over `createMemoryRouter` with `fetch` faked.
 * Routes are `/sales` (a stub) and `/sales/new` (the host, under a layout that gives it `Me`). One group
 * per acceptance criterion: no lines, a line, stacked Sheets, a save, a direct address, one source of truth.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outlet, createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import { inAppState } from '../../components/inAppState'
import { SheetRouterProvider, sheetDepth } from '../../components/useSheetStack'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import { SALE_NEW, SALES } from '../../routes'
import { stubViewport } from '../../test-viewport'
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

let posts: unknown[]
let answerSave: ((response: Response) => void) | null

function stubFetch(holdSave: boolean): void {
  posts = []
  answerSave = null
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url === SALES && init?.method === 'POST') {
        posts.push(JSON.parse(String(init.body)))
        if (holdSave) {
          return new Promise<Response>((resolve) => {
            answerSave = resolve
          })
        }
        return Promise.resolve(json(201, { id: 55 }))
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

interface Mounted {
  router: ReturnType<typeof createMemoryRouter>
  user: ReturnType<typeof userEvent.setup>
  /** Location changes (a different `location.key`) since mounting. */
  changes: () => number
}

const IN_APP = [SALES, { pathname: SALE_NEW, state: inAppState({ pathname: SALES }) }] as const

function mount({
  entries = IN_APP,
  holdSave = false,
  onSaved,
}: { entries?: readonly unknown[]; holdSave?: boolean; onSaved?: NewSaleSheetHostProps['onSaved'] } = {}): Mounted {
  stubFetch(holdSave)
  const router = createMemoryRouter(
    [
      { path: SALES, element: <h1>Sales list</h1> },
      {
        element: <Outlet context={ME} />,
        children: [{ path: SALE_NEW, element: <NewSaleSheetHost onSaved={onSaved} /> }],
      },
    ],
    { initialEntries: [...entries] as never, initialIndex: entries.length - 1 },
  )
  let changes = 0
  let key = router.state.location.key
  router.subscribe((state) => {
    if (state.location.key !== key) {
      key = state.location.key
      changes += 1
    }
  })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MoneyFormatProvider format={FORMAT}>
        <SheetRouterProvider router={router}>
          <RouterProvider router={router} />
        </SheetRouterProvider>
      </MoneyFormatProvider>
    </QueryClientProvider>,
  )
  return { router, user: userEvent.setup(), changes: () => changes }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const sheet = () => screen.getByRole('dialog', { name: 'New sale' })
const question = () => screen.queryByText('Discard the sale?')
const path = (m: Mounted) => m.router.state.location.pathname
const closeButton = () => within(sheet()).getByRole('button', { name: 'Close' })

async function addLine(m: Mounted): Promise<void> {
  await m.user.click(await screen.findByRole('button', { name: 'Add Rosa' }))
}

async function openCollect(m: Mounted): Promise<void> {
  await m.user.click(await screen.findByRole('button', { name: 'Collect' }))
  await screen.findByRole('dialog', { name: /^The sale/ })
}

async function openChooser(m: Mounted): Promise<void> {
  await m.user.click(await within(sheet()).findByRole('button', { name: 'Change' }))
  await screen.findByText('Ana')
}

const EXITS = [
  ['Close', (m: Mounted) => m.user.click(closeButton())],
  ['Escape', (m: Mounted) => m.user.keyboard('{Escape}')],
  ['system back', (m: Mounted) => act(() => m.router.navigate(-1))],
] as const

describe('with no lines', () => {
  test.each(EXITS)('%s just closes with no question', async (_name, exit) => {
    const m = mount()
    await screen.findByRole('heading', { name: 'Most sold' })
    await exit(m)
    await waitFor(() => expect(path(m)).toBe(SALES))
    expect(question()).toBeNull()
  })

  test('a chosen customer alone gives no question', async () => {
    const m = mount()
    await openChooser(m)
    await m.user.click(screen.getByRole('button', { name: /Ana/ }))
    await waitFor(() => expect(within(sheet()).getByText('Ana')).toBeInTheDocument())
    await m.user.click(closeButton())
    await waitFor(() => expect(path(m)).toBe(SALES))
    expect(question()).toBeNull()
  })
})

describe('with a line', () => {
  test.each(EXITS)('%s asks "Discard the sale?", never the Expense question', async (_name, exit) => {
    const m = mount()
    await addLine(m)
    await exit(m)
    expect(await screen.findByText('Discard the sale?')).toBeInTheDocument()
    expect(screen.queryByText(/expense/i)).toBeNull()
    expect(path(m)).toBe(SALE_NEW)
  })

  test('"No, keep entering" keeps the line, and Close asks again', async () => {
    const m = mount()
    await addLine(m)
    await m.user.click(closeButton())
    await m.user.click(await screen.findByRole('button', { name: 'No, keep entering' }))
    await waitFor(() => expect(question()).toBeNull())
    expect(screen.getByRole('group', { name: 'Rosa' })).toBeInTheDocument()
    await m.user.click(closeButton())
    expect(await screen.findByText('Discard the sale?')).toBeInTheDocument()
  })

  test('"Yes, discard it" lands on the list with one location change', async () => {
    const m = mount()
    await addLine(m)
    await m.user.click(closeButton())
    await m.user.click(await screen.findByRole('button', { name: 'Yes, discard it' }))
    await waitFor(() => expect(path(m)).toBe(SALES))
    expect(m.changes()).toBe(1)
  })

  test('two closes in one act with a clean draft make one location change', async () => {
    const m = mount()
    await screen.findByRole('heading', { name: 'Most sold' })
    await act(async () => {
      closeButton().click()
      closeButton().click()
    })
    await waitFor(() => expect(path(m)).toBe(SALES))
    expect(m.changes()).toBe(1)
  })
})

describe('stacked Sheets', () => {
  test.each([
    ['Close', (m: Mounted) => m.user.click(within(screen.getByRole('dialog', { name: /^The sale/ })).getByRole('button', { name: 'Close' }))],
    ['Escape', (m: Mounted) => m.user.keyboard('{Escape}')],
    ['system back', (m: Mounted) => act(() => m.router.navigate(-1))],
  ] as const)('closing Collect by %s never asks and keeps the line', async (_name, exit) => {
    const m = mount()
    await addLine(m)
    await openCollect(m)
    await exit(m)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /^The sale/ })).toBeNull())
    expect(question()).toBeNull()
    expect(path(m)).toBe(SALE_NEW)
    expect(sheetDepth(m.router.state.location.state)).toBe(0)
    expect(screen.getByRole('group', { name: 'Rosa' })).toBeInTheDocument()
  })

  test('closing the customer search never asks and keeps the line', async () => {
    const m = mount()
    await addLine(m)
    await openChooser(m)
    await m.user.click(screen.getAllByRole('button', { name: 'Close' }).at(-1) as HTMLElement)
    await waitFor(() => expect(screen.queryByText('Pick a customer')).toBeNull())
    expect(question()).toBeNull()
    expect(screen.getByRole('group', { name: 'Rosa' })).toBeInTheDocument()
  })

  test('closing Create customer goes back to the search, never asks and keeps the line', async () => {
    const m = mount()
    await addLine(m)
    await openChooser(m)
    await m.user.click(screen.getByRole('button', { name: 'New customer' }))
    await waitFor(() => expect(sheetDepth(m.router.state.location.state)).toBe(2))
    await act(() => m.router.navigate(-1))
    await waitFor(() => expect(sheetDepth(m.router.state.location.state)).toBe(1))
    expect(question()).toBeNull()
    expect(screen.getByRole('group', { name: 'Rosa' })).toBeInTheDocument()
  })

  test('Collect, back, then the chooser: Collect is not drawn', async () => {
    const m = mount()
    await addLine(m)
    await openCollect(m)
    await act(() => m.router.navigate(-1))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /^The sale/ })).toBeNull())
    await openChooser(m)
    expect(screen.queryByRole('dialog', { name: /^The sale/ })).toBeNull()
  })

  test('over holds while the push is pending, and then Collect shows', async () => {
    const m = mount()
    await addLine(m)
    const open = await screen.findByRole('button', { name: 'Collect' })
    await act(async () => {
      open.click()
      expect(screen.queryByRole('dialog', { name: /^The sale/ })).toBeNull()
    })
    expect(await screen.findByRole('dialog', { name: /^The sale/ })).toBeInTheDocument()
  })

  test('over holds while the push is pending, and then the chooser shows', async () => {
    const m = mount()
    const change = await within(sheet()).findByRole('button', { name: 'Change' })
    await act(async () => {
      change.click()
      expect(screen.queryByText('Pick a customer')).toBeNull()
    })
    expect(await screen.findByText('Pick a customer')).toBeInTheDocument()
    expect(path(m)).toBe(SALE_NEW)
  })

  test('Escape during a held save leaves Collect open', async () => {
    const m = mount({ holdSave: true })
    await addLine(m)
    await openCollect(m)
    await m.user.click(await screen.findByRole('button', { name: /^How they pay/ }))
    await m.user.click(await screen.findByRole('button', { name: 'Cash' }))
    await m.user.click(within(screen.getByRole('dialog', { name: /^The sale/ })).getByRole('button', { name: /^Collect/ }))
    await waitFor(() => expect(posts).toHaveLength(1))
    await m.user.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: /^The sale/ })).toBeInTheDocument()
    expect(sheetDepth(m.router.state.location.state)).toBe(1)
    await act(async () => answerSave?.(json(201, { id: 55 })))
    await waitFor(() => expect(path(m)).toBe(SALES))
  })

  test('Escape inside an open Selector list closes only the list', async () => {
    const m = mount()
    await addLine(m)
    await openCollect(m)
    await m.user.click(await screen.findByRole('button', { name: /^How they pay/ }))
    await screen.findByRole('button', { name: 'Cash' })
    await m.user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cash' })).toBeNull())
    expect(screen.getByRole('dialog', { name: /^The sale/ })).toBeInTheDocument()
    expect(question()).toBeNull()
  })
})

describe('a save', () => {
  /** Returns the location changes counted before the save is tapped. */
  async function saveWithLine(m: Mounted): Promise<number> {
    await addLine(m)
    await openCollect(m)
    await m.user.click(await screen.findByRole('button', { name: /^How they pay/ }))
    await m.user.click(await screen.findByRole('button', { name: 'Cash' }))
    await waitFor(() => expect(sheetDepth(m.router.state.location.state)).toBe(1))
    const before = m.changes()
    await m.user.click(within(screen.getByRole('dialog', { name: /^The sale/ })).getByRole('button', { name: /^Collect/ }))
    return before
  }

  test('with a line never asks and makes exactly one location change, landing on the list', async () => {
    const m = mount()
    const before = await saveWithLine(m)
    await waitFor(() => expect(path(m)).toBe(SALES))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    expect(posts).toHaveLength(1)
    expect(question()).toBeNull()
    // The Collect entry and the Sheet's own are walked back in one traversal.
    expect(m.changes() - before).toBe(1)
  })

  test('a custom onSaved receives the id and the customer name, and the host does not leave', async () => {
    const onSaved = vi.fn<NonNullable<NewSaleSheetHostProps['onSaved']>>()
    const m = mount({ onSaved })
    await openChooser(m)
    await m.user.click(screen.getByRole('button', { name: /Ana/ }))
    await waitFor(() => expect(within(sheet()).getByText('Ana')).toBeInTheDocument())
    await saveWithLine(m)
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(55, 'Ana'))
    expect(path(m)).toBe(SALE_NEW)
  })
})

describe('a direct address', () => {
  const DIRECT = [SALE_NEW] as const

  test('with no lines Close replaces with the parent and asks nothing', async () => {
    const m = mount({ entries: DIRECT })
    await screen.findByRole('heading', { name: 'Most sold' })
    await m.user.click(closeButton())
    await waitFor(() => expect(path(m)).toBe(SALES))
    expect(question()).toBeNull()
    expect(m.router.state.historyAction).toBe('REPLACE')
  })

  test('with a line Close asks, and "Yes" lands on the list with one change', async () => {
    const m = mount({ entries: DIRECT })
    await addLine(m)
    await m.user.click(closeButton())
    expect(await screen.findByText('Discard the sale?')).toBeInTheDocument()
    await m.user.click(screen.getByRole('button', { name: 'Yes, discard it' }))
    await waitFor(() => expect(path(m)).toBe(SALES))
    expect(m.changes()).toBe(1)
  })

  test('the Customer row says "No customer", never the Loading mark', async () => {
    mount({ entries: DIRECT })
    expect(within(sheet()).getByText('No customer')).toBeInTheDocument()
  })
})

describe('one source of truth', () => {
  test('on a computer the backdrop does nothing once a line is added, and works again after stepDown', async () => {
    stubViewport('computer')
    const m = mount()
    await addLine(m)
    const backdrop = sheet().parentElement as HTMLElement
    await m.user.click(backdrop)
    expect(path(m)).toBe(SALE_NEW)
    expect(question()).toBeNull()
    await m.user.click(within(screen.getByRole('group', { name: 'Rosa' })).getByRole('button', { name: 'Remove one Rosa' }))
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Rosa' })).toBeNull())
    await m.user.click(backdrop)
    await waitFor(() => expect(path(m)).toBe(SALES))
  })

  test('the guard and the Sheet follow one line added, and both clear after stepDown', async () => {
    const m = mount()
    await screen.findByRole('heading', { name: 'Most sold' })
    // The computer backdrop: an untouched Sheet closes on a click on it, a touched one does not.
    await addLine(m)
    await m.user.click(closeButton())
    expect(await screen.findByText('Discard the sale?')).toBeInTheDocument()
    await m.user.click(screen.getByRole('button', { name: 'No, keep entering' }))
    await waitFor(() => expect(question()).toBeNull())
    await m.user.click(within(screen.getByRole('group', { name: 'Rosa' })).getByRole('button', { name: 'Remove one Rosa' }))
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Rosa' })).toBeNull())
    await m.user.click(closeButton())
    await waitFor(() => expect(path(m)).toBe(SALES))
    expect(question()).toBeNull()
  })
})
