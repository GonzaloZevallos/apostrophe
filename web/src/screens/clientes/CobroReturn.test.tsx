/**
 * Record payment's return of place, the whole way through (GH-480): the app's real route table
 * (`appRouter.routes`, so the real `ScrollSync`, `ClientesLayout`/`Clientes`, `CobroRoute` and
 * `Inicio`) under StrictMode, with `fetch` faked. The hand-off is written by an exit of Record
 * payment, never by opening it: a save and Close focus the customer's control, Back leaves
 * nothing behind, and the next open starts clean. The page's scroll is `ScrollSync`'s, so nothing here scrolls it.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import panelFixture from '../../api/fixtures/panel.json'
import { inAppState } from '../../components/inAppState'
import { consumePaymentReturn, peekPaymentReturn } from '../../paymentReturn'
import { router as appRouter } from '../../router'
import { CUSTOMERS, HOME } from '../../routes'
import { renderWithViewport } from '../../test-viewport'
import type { Viewport } from '../../routes'

const ME = { email: 'a@b.com', business_name: 'Business', today: '2026-10-03' }
const OWING = { id: 1, name: 'Ana Pérez', phone: '+5491122334455', vip: false, balance: 11000, owing_since: '2026-09-14', standing: 'owes' }
const ACCOUNT = {
  balance: 11000,
  owing_since: '2026-09-14',
  standing: 'owes',
  rows: [{ kind: 'sale', date: '2026-09-14', running_balance: 11000, standing: 'owes', sale: { id: 10, total: 11000, how_paid: 'owing' } }],
}
const DEBTORS = { total_owed: 11000, sales_owing_count: 1, debtors: [{ customer: { id: 1, name: 'Ana Pérez' }, balance: 11000, owing_since: '2026-09-14', standing: 'owes' }] }
const RECORDED = {
  payment: { id: 5, paid_on: '2026-10-03', amount: 5000, method: 'cash' },
  applied_to: [{ sale_id: 10, sale_date: '2026-09-14', amount: 5000 }],
  after: { balance: 6000, owing_since: '2026-09-14', standing: 'owes' },
}
const COLLECT = 'Collect from Ana Pérez'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const ANSWERS: Record<string, () => Response> = {
  'GET /auth/me': () => jsonResponse(200, ME),
  'GET /pricing-settings': () => jsonResponse(200, { is_bulk_pricing: true, is_vip_customers: true }),
  'GET /customers': () => jsonResponse(200, [OWING]),
  'GET /customers/1': () => jsonResponse(200, OWING),
  'GET /customers/1/account': () => jsonResponse(200, ACCOUNT),
  'GET /payments/debtors': () => jsonResponse(200, DEBTORS),
  'GET /panel': () => jsonResponse(200, panelFixture),
  'POST /customers/1/payments/preview': () => jsonResponse(200, RECORDED),
  'POST /customers/1/payments': () => jsonResponse(201, RECORDED),
  'GET /first-run': () => jsonResponse(200, { kind: 'none', checklist: [], import_notice: false, nothing_qualifies: false }),
  'GET /varieties': () => jsonResponse(200, [{ current_price: { id: 1 } }]),
  'GET /pinned-catalog/status': () => jsonResponse(200, { status: null }),
  'GET /onboarding-progress': () => jsonResponse(200, { offered: false }),
}

function renderFrom(origin: string, viewport: Viewport) {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const answer = ANSWERS[`${init?.method ?? 'GET'} ${url}`]
      return Promise.resolve(answer === undefined ? jsonResponse(404, {}) : answer())
    }),
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(appRouter.routes, { initialEntries: [origin] })
  renderWithViewport(viewport, () =>
    render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </StrictMode>,
    ),
  )
  return router
}

afterEach(() => {
  consumePaymentReturn()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function open(): Promise<void> {
  await userEvent.click((await screen.findAllByRole('link', { name: COLLECT }))[0]!)
  await screen.findByRole('button', { name: 'Save' })
}

async function pause(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 50))
}

describe.each<[string, string, string]>([
  ['Customers', CUSTOMERS, 'customers'],
  ['Home', HOME, 'home'],
])('opened from %s', (_name, origin, underneath) => {
  test.each<Viewport>(['phone', 'computer'])('on a %s a save and Close focus the customer\'s control, Back does not, and each exit leaves no hand-off', async (viewport) => {
    const router = renderFrom(origin, viewport)
    const collect = async () => (await screen.findAllByRole('link', { name: COLLECT }))[0]!

    // Opening writes nothing; Close focuses the control and the origin takes the hand-off.
    await open()
    expect(peekPaymentReturn()).toBeNull()
    // The link opens the form as an in-app entry over the screen it came from.
    expect(router.state.location.state).toEqual(inAppState({ pathname: origin }, { underneath }))
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(origin))
    expect(router.state.historyAction).toBe('POP')
    await waitFor(async () => expect(await collect()).toHaveFocus())
    expect(peekPaymentReturn()).toBeNull()
    await userEvent.tab()
    expect(await collect()).not.toHaveFocus()

    // Open → Back: nothing is left and nothing is focused.
    await open()
    await act(() => router.navigate(-1))
    await waitFor(() => expect(router.state.location.pathname).toBe(origin))
    await pause()
    expect(peekPaymentReturn()).toBeNull()
    expect(await collect()).not.toHaveFocus()

    // Open → save: the origin focuses the customer's control, and the hand-off is taken.
    await open()
    await userEvent.click(await screen.findByRole('radio', { name: 'Cash' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(origin))
    await waitFor(async () => expect(await collect()).toHaveFocus())
    expect(peekPaymentReturn()).toBeNull()

    // The next open starts clean: the save left nothing, and a Back right after it focuses nothing.
    await open()
    expect(peekPaymentReturn()).toBeNull()
    await act(() => router.navigate(-1))
    await waitFor(() => expect(router.state.location.pathname).toBe(origin))
    await pause()
    expect(peekPaymentReturn()).toBeNull()
  })
})
