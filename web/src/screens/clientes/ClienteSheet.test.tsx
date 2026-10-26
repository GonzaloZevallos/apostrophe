/**
 * The customer form (new, edit) as a sheet, at the tree seam: the app's real route table with
 * `fetch` faked. On a phone a direct address shows the form as a sheet over its parent (new over
 * Customers, edit over the customer's card), the parent drawn as an inert, hidden `BehindPane`;
 * focus is in the first field and the sheet shows exactly one Close. On a computer the form is the
 * page it always was, with nothing behind it (ADR-0053).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { router as appRouter } from '../../router'
import { CUSTOMER, CUSTOMER_EDIT, CUSTOMER_NEW, CUSTOMERS, pathTo } from '../../routes'
import type { Viewport } from '../../routes'
import { COMMON_TEXT } from '../../copy/common'
import { behindPane, expectBehindPane, expectBehindPaneEmpty } from '../../test/behindPane'
import { flipViewport, renderWithViewport } from '../../test-viewport'

const ME = { email: 'a@b.com', business_name: 'Business', today: '2026-10-03' }
const ANA = { id: 1, name: 'Ana Pérez', phone: '+5491122334455', vip: false, balance: 11000, owing_since: '2026-09-14', standing: 'owes' }
const BETO = { id: 2, name: 'Beto Gómez', phone: null, vip: false, balance: 0, owing_since: null, standing: 'settled' }
const ACCOUNT = {
  balance: 11000,
  owing_since: '2026-09-14',
  standing: 'owes',
  rows: [{ kind: 'sale', date: '2026-09-14', running_balance: 11000, standing: 'owes', sale: { id: 10, total: 11000, how_paid: 'owing' } }],
}
const DEBTORS = { total_owed: 11000, sales_owing_count: 1, debtors: [{ customer: { id: 1, name: 'Ana Pérez' }, balance: 11000, owing_since: '2026-09-14', standing: 'owes' }] }
const EDIT = pathTo(CUSTOMER_EDIT, { id: 1 })

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

type Answers = Record<string, () => Response | Promise<Response>>

function renderApp(entries: { pathname: string; state?: unknown }[], viewport: Viewport, answers: Answers = {}) {
  const table: Answers = {
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /pricing-settings': () => jsonResponse(200, { is_bulk_pricing: true, is_vip_customers: true }),
    'GET /customers': () => jsonResponse(200, [ANA, BETO]),
    'GET /customers/1': () => jsonResponse(200, ANA),
    'GET /customers/1/account': () => jsonResponse(200, ACCOUNT),
    'GET /payments/debtors': () => jsonResponse(200, DEBTORS),
    'GET /first-run': () => jsonResponse(200, { kind: 'none', checklist: [], import_notice: false, nothing_qualifies: false }),
    'GET /varieties': () => jsonResponse(200, [{ current_price: { id: 1 } }]),
    'GET /pinned-catalog/status': () => jsonResponse(200, { status: null }),
    'GET /onboarding-progress': () => jsonResponse(200, { offered: false }),
    ...answers,
  }
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const answer = table[`${init?.method ?? 'GET'} ${url}`]
      return Promise.resolve(answer === undefined ? jsonResponse(404, {}) : answer())
    }),
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(appRouter.routes, { initialEntries: entries, initialIndex: entries.length - 1 })
  renderWithViewport(viewport, () =>
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  )
  return router
}

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(window, 'scrollY')
})

describe('on a phone, a direct address', () => {
  test('new customer: the sheet over the Customers list, focus in Name, one Close', async () => {
    renderApp([{ pathname: CUSTOMER_NEW }], 'phone')

    const dialog = await screen.findByRole('dialog', { name: COMMON_TEXT.newCustomer })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus()
    expect(screen.getAllByRole('button', { name: COMMON_TEXT.close })).toHaveLength(1)
    expect(within(dialog).getByRole('button', { name: COMMON_TEXT.close })).toBeInTheDocument()

    const pane = behindPane()
    expectBehindPane(pane)
    await waitFor(() => expect(pane).toHaveTextContent('Ana Pérez'))
    expect(pane).toHaveTextContent('Beto Gómez')
    expect(pane).not.toContainElement(dialog)
    expect(document.querySelector('.sheet__actions')).toContainElement(screen.getByRole('button', { name: 'Save and use' }))
  })

  test('edit customer: the sheet over the customer\'s card, focus in Name, one Close', async () => {
    renderApp([{ pathname: EDIT }], 'phone')

    const dialog = await screen.findByRole('dialog', { name: COMMON_TEXT.editCustomer })
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus())
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Ana Pérez')
    expect(screen.getAllByRole('button', { name: COMMON_TEXT.close })).toHaveLength(1)

    const pane = behindPane()
    expectBehindPane(pane)
    await waitFor(() => expect(pane).toHaveTextContent('Ana Pérez'))
    expect(pane).toHaveTextContent('$ 11.000')
    expect(pane).not.toContainElement(dialog)
  })

  test('the pane is empty while the data is pending', async () => {
    renderApp([{ pathname: CUSTOMER_NEW }], 'phone', { 'GET /customers': () => new Promise<Response>(() => undefined) })

    await screen.findByRole('dialog', { name: COMMON_TEXT.newCustomer })
    expectBehindPaneEmpty(behindPane())
  })

  test('a gone customer: the pane is empty and the form shows its gone handling', async () => {
    const gone = () => jsonResponse(404, { detail: 'no such customer', code: 'customer.not_found' })
    renderApp([{ pathname: EDIT }], 'phone', { 'GET /customers/1': gone })

    expect(await screen.findByText('That is gone.')).toBeInTheDocument()
    expectBehindPaneEmpty(behindPane())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('a server error: the pane is empty, with no wording of its own', async () => {
    renderApp([{ pathname: CUSTOMER_NEW }], 'phone', { 'GET /customers': () => jsonResponse(500, {}) })

    await screen.findByRole('dialog', { name: COMMON_TEXT.newCustomer })
    await act(() => new Promise((resolve) => setTimeout(resolve, 30)))
    expectBehindPaneEmpty(behindPane())
  })
})

describe('on a computer', () => {
  test.each([CUSTOMER_NEW, EDIT])('%s is the form page with nothing behind it', async (path) => {
    renderApp([{ pathname: path }], 'computer')

    expect(await screen.findByRole('textbox', { name: 'Name' })).toBeInTheDocument()
    expect(document.querySelector('.behind-pane')).toBeNull()
    expect(document.querySelector('.sheet')).toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('a sheet kept across 900 px', () => {
  test('a viewport flip on edit keeps the typed text and the same field', async () => {
    renderApp([{ pathname: EDIT }], 'phone')
    const name = await screen.findByRole('textbox', { name: 'Name' })
    await userEvent.type(name, ' Jr')

    flipViewport('computer')
    expect(screen.getByRole('textbox', { name: 'Name' })).toBe(name)
    expect(name).toHaveValue('Ana Pérez Jr')
    expect(document.querySelector('.behind-pane')).toBeNull()

    flipViewport('phone')
    expect(screen.getByRole('textbox', { name: 'Name' })).toBe(name)
    expect(name).toHaveValue('Ana Pérez Jr')
  })
})

describe('Close', () => {
  test('from a scrolled Customers list returns to it at the same scroll position', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 480 })
    const router = renderApp([{ pathname: CUSTOMERS }], 'phone')

    await userEvent.click(await screen.findByRole('link', { name: COMMON_TEXT.newCustomer }))
    await screen.findByRole('dialog', { name: COMMON_TEXT.newCustomer })
    expect(router.state.location.pathname).toBe(CUSTOMER_NEW)
    await userEvent.click(screen.getByRole('button', { name: COMMON_TEXT.close }))

    await waitFor(() => expect(router.state.location.pathname).toBe(CUSTOMERS))
    await screen.findByRole('link', { name: COMMON_TEXT.newCustomer })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // The page was held where it was (the lock never scrolls it) and nothing moved it.
    expect(window.scrollY).toBe(480)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  test('from edit goes to the card', async () => {
    const router = renderApp([{ pathname: pathTo(CUSTOMER, { id: 1 }) }], 'phone')

    await userEvent.click(await screen.findByRole('link', { name: COMMON_TEXT.edit }))
    await screen.findByRole('dialog', { name: COMMON_TEXT.editCustomer })
    // Opened from the card, the pane shows the card the form was opened from.
    expectBehindPane(behindPane())
    await userEvent.click(screen.getByRole('button', { name: COMMON_TEXT.close }))

    await waitFor(() => expect(router.state.location.pathname).toBe(pathTo(CUSTOMER, { id: 1 })))
  })
})
