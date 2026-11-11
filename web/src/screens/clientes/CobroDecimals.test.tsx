import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { router as appRouter } from '../../router'
import { CUSTOMER_PAYMENT, pathTo } from '../../routes'
import type { Viewport } from '../../routes'
import { renderWithViewport } from '../../test-viewport'
import { SheetRouterProvider } from '../../components/useSheetStack'
import { choosePaymentMethod } from '../../components/selectorTestKit'

const ME = { email: 'a@b.com', business_name: 'Business', today: '2026-10-03', money: { symbol: 'US$', decimals: 2 } }
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
const PAYMENT = pathTo(CUSTOMER_PAYMENT, { id: 1 })

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

type Answers = Record<string, () => Response>

function renderApp(entries: { pathname: string; state?: unknown }[], viewport: Viewport, answers: Answers = {}) {
  const table: Answers = {
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /pricing-settings': () => jsonResponse(200, { is_bulk_pricing: true, is_vip_customers: true }),
    'GET /customers': () => jsonResponse(200, [OWING]),
    'GET /customers/1': () => jsonResponse(200, OWING),
    'GET /customers/1/account': () => jsonResponse(200, ACCOUNT),
    'GET /payments/debtors': () => jsonResponse(200, DEBTORS),
    'POST /customers/1/payments/preview': () => jsonResponse(200, RECORDED),
    'POST /customers/1/payments': () => jsonResponse(201, RECORDED),
    'GET /first-run': () => jsonResponse(200, { kind: 'none', checklist: [], import_notice: false, nothing_qualifies: false }),
    'GET /api/products': () => jsonResponse(200, [{ current_price: { id: 1 } }]),
    'GET /pinned-catalog/status': () => jsonResponse(200, { status: null }),
    'GET /onboarding-progress': () => jsonResponse(200, { offered: false }),
    ...answers,
  }
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const answer = table[`${init?.method ?? 'GET'} ${url}`]
      return answer === undefined ? Promise.resolve(jsonResponse(404, {})) : Promise.resolve(answer())
    }),
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(appRouter.routes, { initialEntries: entries, initialIndex: entries.length - 1 })
  renderWithViewport(viewport, () =>
    render(
      <QueryClientProvider client={queryClient}>
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

describe('the amount field under a Money format with 2 decimals', () => {
  async function openForm(answers: Answers = {}) {
    renderApp([{ pathname: PAYMENT }], 'phone', answers)
    await screen.findByRole('button', { name: 'Save' })
  }

  function posted(): unknown {
    const call = vi.mocked(fetch).mock.calls.find(([url, init]) => `${init?.method ?? 'GET'} ${url}` === 'POST /customers/1/payments')
    return call === undefined ? undefined : JSON.parse(String(call[1]?.body))
  }

  test('opens a decimal keyboard, prefilled with the balance written as formatMoneyInput writes it', async () => {
    await openForm()
    const amount = screen.getByLabelText('Amount')
    expect(amount).toHaveAttribute('inputmode', 'decimal')
    expect(amount).toHaveValue('11000,00')
  })

  test('reads 11,5, shows it back as 11,50 on leaving the field, and posts 11.5', async () => {
    await openForm()
    const amount = screen.getByLabelText('Amount')
    await userEvent.clear(amount)
    await userEvent.type(amount, '11,5')
    expect(amount).toHaveValue('11,5')
    await userEvent.tab()
    expect(amount).toHaveValue('11,50')
    await choosePaymentMethod(userEvent, 'Cash')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(posted()).toEqual({ paid_on: '2026-10-03', amount: 11.5, method: 'cash' }))
  })

  test('refuses 11,505 on save with the decimals rule, keeps what was typed and sends nothing', async () => {
    await openForm()
    const amount = screen.getByLabelText('Amount')
    await userEvent.clear(amount)
    await userEvent.type(amount, '11,505')
    await choosePaymentMethod(userEvent, 'Cash')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Use up to 2 decimals.')
    expect(amount).toHaveValue('11,505')
    expect(posted()).toBeUndefined()
  })
})
