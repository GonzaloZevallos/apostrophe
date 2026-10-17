/**
 * Registrar cobro at the tree seam: the app's real route table (`appRouter.routes`) rendered
 * with `fetch` faked. On a computer `/customers/{id}/payment` is a dialog over the list and the
 * customer's card, both inert and `aria-hidden` (ADR-0044); on a phone it is the full form
 * screen. Every way out is the host's one leave, and a save lands on the screen it was opened
 * from. jsdom proves only the `inert` attribute: `web/e2e/cobroModal.spec.ts` proves in a
 * browser that nothing behind can be reached.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { router as appRouter } from '../../router'
import { CUSTOMER_PAYMENT, CUSTOMERS, HOME, pathTo } from '../../routes'
import type { Viewport } from '../../routes'
import { renderWithViewport } from '../../test-viewport'
import { inAppState } from '../../components/inAppState'

const ME = { email: 'a@b.com', business_name: 'Negocio', today: '2026-10-03' }
const OWING = { id: 1, name: 'Ana Pérez', phone: '+5491122334455', vip: false, balance: 11000, owing_since: '2026-09-14', standing: 'owes' }
const SETTLED = { ...OWING, balance: 0, owing_since: null, standing: 'settled' }
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
    'GET /varieties': () => jsonResponse(200, [{ current_price: { id: 1 } }]),
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
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  )
  return router
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('on a computer', () => {
  test('a direct link opens the dialog with the customer chosen, over a list and a card that are inert and aria-hidden', async () => {
    renderApp([{ pathname: PAYMENT }], 'computer')

    const dialog = await screen.findByRole('dialog', { name: 'Registrar cobro' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveTextContent('Ana Pérez · te debe $ 11.000 desde el 14/09')
    for (const selector of ['.cobro-paneles__lista', '.cobro-paneles__detalle']) {
      const pane = document.querySelector(selector)
      expect(pane).not.toBeNull()
      expect(pane).toHaveAttribute('inert')
      expect(pane).toHaveAttribute('aria-hidden', 'true')
      expect(pane).not.toContainElement(dialog)
    }
    expect(document.querySelector('nav.riel-lateral')).toBeNull()
  })

  test('Escape and the backdrop leave like Cerrar does: to Clientes when nothing is behind', async () => {
    const router = renderApp([{ pathname: PAYMENT }], 'computer')
    await screen.findByRole('dialog', { name: 'Registrar cobro' })

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(router.state.location.pathname).toBe(CUSTOMERS))
  })

  test('the backdrop ends in the same leave', async () => {
    const router = renderApp([{ pathname: PAYMENT }], 'computer')
    await screen.findByRole('dialog', { name: 'Registrar cobro' })

    const backdrop = document.querySelector<HTMLElement>('.cobro-modal')
    expect(backdrop).not.toBeNull()
    fireEvent.click(backdrop as HTMLElement)
    await waitFor(() => expect(router.state.location.pathname).toBe(CUSTOMERS))
  })

  test('with something typed, Escape asks first and does not leave', async () => {
    const router = renderApp([{ pathname: PAYMENT }], 'computer')
    await screen.findByRole('dialog', { name: 'Registrar cobro' })
    await userEvent.click(screen.getByLabelText('Efectivo'))

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(await screen.findByText('¿Descartás el cobro?')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(PAYMENT)
    // A second Escape does nothing while the question shows.
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(router.state.location.pathname).toBe(PAYMENT)
  })
})

describe('on a phone', () => {
  test('the form is a full screen: no dialog, no pane and nothing inert behind it', async () => {
    renderApp([{ pathname: PAYMENT }], 'phone')

    expect(await screen.findByRole('button', { name: 'Guardar' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.querySelector('.cobro-paneles__lista')).toBeNull()
    expect(document.querySelector('[inert]')).toBeNull()
  })
})

describe.each<Viewport>(['phone', 'computer'])('opened from a list, on a %s', (viewport) => {
  test('from Clientes: a save lands on Clientes with the toast, and one back afterwards leaves', async () => {
    const router = renderApp([{ pathname: HOME }, { pathname: CUSTOMERS }], viewport)
    await userEvent.click((await screen.findAllByRole('link', { name: 'Cobrar a Ana Pérez' }))[0]!)
    await userEvent.click(await screen.findByLabelText('Efectivo'))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(CUSTOMERS))
    expect(await screen.findByText('Cobro guardado · queda debiendo $ 6.000')).toBeInTheDocument()
    await act(() => router.navigate(-1))
    expect(router.state.location.pathname).toBe(HOME)
  })

  test('from Inicio: a save lands on Inicio', async () => {
    const router = renderApp(
      [{ pathname: HOME }, { pathname: PAYMENT, state: inAppState({ pathname: HOME }) }],
      viewport,
      { 'GET /panel': () => jsonResponse(200, { debtors: [] }) },
    )
    await userEvent.click(await screen.findByLabelText('Efectivo'))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(HOME))
  })
})

test('a customer answered as settled opens without an error, and the save is refused inline', async () => {
  renderApp([{ pathname: PAYMENT }], 'phone', {
    'GET /customers/1': () => jsonResponse(200, SETTLED),
    'POST /customers/1/payments': () => jsonResponse(422, { code: 'payment.above_balance' }),
  })

  const save = await screen.findByRole('button', { name: 'Guardar' })
  await userEvent.click(screen.getByLabelText('Efectivo'))
  await userEvent.click(save)

  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(screen.getByLabelText('Efectivo')).toBeChecked()
})

test('a customer that is gone shows "That\'s gone." with a way back to Clientes', async () => {
  renderApp([{ pathname: PAYMENT }], 'phone', {
    'GET /customers/1': () => jsonResponse(404, { code: 'customer.not_found' }),
  })

  expect(await screen.findByText("That's gone.")).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Volver a Clientes' })).toBeInTheDocument()
})
