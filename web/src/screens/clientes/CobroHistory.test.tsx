/**
 * Registrar cobro's history from its three entry points (the Customers debtor row, the Home debtor
 * row, the Customer page): the Payment method list is its own history entry, so back closes only
 * the list, a clean form goes to its parent and a dirty one (a method alone counts) asks first.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import panelFixture from '../../api/fixtures/panel.json'
import { choosePaymentMethod } from '../../components/selectorTestKit'
import { SheetRouterProvider } from '../../components/useSheetStack'
import { router as appRouter } from '../../router'
import { CUSTOMER, CUSTOMER_PAYMENT, CUSTOMERS, HOME, pathTo } from '../../routes'
import type { Viewport } from '../../routes'
import { renderWithViewport } from '../../test-viewport'

const ME = { email: 'a@b.com', business_name: 'Business', today: '2026-10-03', money_format: { symbol: '$', decimals: 0 } }
const OWING = { id: 1, name: 'Ana Pérez', phone: '+5491122334455', vip: false, balance: 11000, owing_since: '2026-09-14', standing: 'owes' }
const ACCOUNT = {
  balance: 11000,
  owing_since: '2026-09-14',
  standing: 'owes',
  rows: [{ kind: 'sale', date: '2026-09-14', running_balance: 11000, standing: 'owes', sale: { id: 10, total: 11000, how_paid: 'owing' } }],
}
const DEBTORS = { total_owed: 11000, sales_owing_count: 1, debtors: [{ customer: { id: 1, name: 'Ana Pérez' }, balance: 11000, owing_since: '2026-09-14', standing: 'owes' }] }
const PREVIEW = {
  payment: { id: 5, paid_on: '2026-10-03', amount: 5000, method: 'cash' },
  applied_to: [{ sale_id: 10, sale_date: '2026-09-14', amount: 5000 }],
  after: { balance: 6000, owing_since: '2026-09-14', standing: 'owes' },
}
const PAYMENT = pathTo(CUSTOMER_PAYMENT, { id: 1 })
const CARD = pathTo(CUSTOMER, { id: 1 })
const LIST = { name: 'Payment method options' }

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function renderApp(pathname: string, viewport: Viewport) {
  const table: Record<string, () => Response> = {
    'GET /auth/me': () => json(200, ME),
    'GET /pricing-settings': () => json(200, { is_bulk_pricing: true, is_vip_customers: true }),
    'GET /customers': () => json(200, [OWING]),
    'GET /customers/1': () => json(200, OWING),
    'GET /customers/1/account': () => json(200, ACCOUNT),
    'GET /payments/debtors': () => json(200, DEBTORS),
    'GET /panel': () => json(200, panelFixture),
    'POST /customers/1/payments/preview': () => json(200, PREVIEW),
    'GET /first-run': () => json(200, { kind: 'none', checklist: [], import_notice: false, nothing_qualifies: false }),
    'GET /api/products': () => json(200, [{ current_price: { id: 1 } }]),
    'GET /pinned-catalog/status': () => json(200, { status: null }),
    'GET /onboarding-progress': () => json(200, { offered: false }),
  }
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const answer = table[`${init?.method ?? 'GET'} ${url}`]
      return Promise.resolve(answer === undefined ? json(404, {}) : answer())
    }),
  )
  const router = createMemoryRouter(appRouter.routes, { initialEntries: [{ pathname: HOME }, { pathname }], initialIndex: 1 })
  renderWithViewport(viewport, () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SheetRouterProvider router={router}>
          <RouterProvider router={router} />
        </SheetRouterProvider>
      </QueryClientProvider>,
    ),
  )
  return router
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const ORIGINS: [string, string, string][] = [
  ['the Customers debtor row', CUSTOMERS, 'Collect from Ana Pérez'],
  ['the Home debtor row', HOME, 'Collect from Ana Pérez'],
  ['the Customer page', CARD, 'Record payment'],
]

const field = () => screen.findByRole('button', { name: /^Payment method/ })

/** Opens Registrar cobro from `origin`'s own control. */
async function openFrom(origin: string, link: string, viewport: Viewport) {
  const router = renderApp(origin, viewport)
  await userEvent.click((await screen.findAllByRole('link', { name: link }))[0]!)
  await field()
  expect(router.state.location.pathname).toBe(PAYMENT)
  return router
}

describe.each(ORIGINS)('from %s, on a phone', (_name, origin, link) => {
  test('a clean form: back goes to the parent', async () => {
    const router = await openFrom(origin, link, 'phone')
    await act(() => router.navigate(-1))
    await waitFor(() => expect(router.state.location.pathname).toBe(origin))
    expect(screen.queryByText('Discard the payment?')).toBeNull()
  })

  test('a dirty form: back asks LeaveConfirm and stays', async () => {
    const router = await openFrom(origin, link, 'phone')
    await userEvent.type(screen.getByLabelText('Amount'), '5')
    await act(() => router.navigate(-1))
    expect(await screen.findByText('Discard the payment?')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(PAYMENT)
  })

  test('a form where only the method was chosen is dirty: back asks LeaveConfirm', async () => {
    const router = await openFrom(origin, link, 'phone')
    await choosePaymentMethod(userEvent, 'Transfer')
    await waitFor(() => expect(screen.queryByRole('dialog', LIST)).toBeNull())
    await act(() => router.navigate(-1))
    expect(await screen.findByText('Discard the payment?')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(PAYMENT)
  })

  test.each([
    ['clean', false],
    ['dirty', true],
  ])('with the list open on a %s form, back closes only the list', async (_state, dirty) => {
    const router = await openFrom(origin, link, 'phone')
    if (dirty) await userEvent.type(screen.getByLabelText('Amount'), '5')
    await userEvent.click(await field())
    expect(await screen.findByRole('dialog', LIST)).toBeInTheDocument()

    await act(() => router.navigate(-1))
    await waitFor(() => expect(screen.queryByRole('dialog', LIST)).toBeNull())
    expect(router.state.location.pathname).toBe(PAYMENT)
    expect(screen.queryByText('Discard the payment?')).toBeNull()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  test('Close on the list closes only the list', async () => {
    const router = await openFrom(origin, link, 'phone')
    await userEvent.click(await field())
    const list = await screen.findByRole('dialog', LIST)
    await userEvent.click(within(list).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', LIST)).toBeNull())
    expect(router.state.location.pathname).toBe(PAYMENT)
  })
})

describe('on a computer', () => {
  test('Escape closes only the dropdown; the next Escape leaves a clean form', async () => {
    const router = await openFrom(CUSTOMERS, 'Collect from Ana Pérez', 'computer')
    await userEvent.click(await field())
    fireEvent.keyDown(await screen.findByRole('listbox'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    expect(router.state.location.pathname).toBe(PAYMENT)
    expect(screen.queryByText('Discard the payment?')).toBeNull()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(router.state.location.pathname).toBe(CUSTOMERS))
  })

  test('on a dirty form the second Escape asks LeaveConfirm', async () => {
    const router = await openFrom(CUSTOMERS, 'Collect from Ana Pérez', 'computer')
    await userEvent.type(screen.getByLabelText('Amount'), '5')
    await userEvent.click(await field())
    fireEvent.keyDown(await screen.findByRole('listbox'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    expect(screen.queryByText('Discard the payment?')).toBeNull()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(await screen.findByText('Discard the payment?')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(PAYMENT)
  })
})
