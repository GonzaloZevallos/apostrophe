/**
 * Registrar cobro at the tree seam: the app's real route table (`appRouter.routes`) rendered
 * with `fetch` faked. On a computer `/customers/{id}/payment` is a dialog over the list and the
 * customer's card, both inert and `aria-hidden` (ADR-0044); on a phone it is the full form
 * screen. Every way out is the host's one leave, and a save lands on the screen it was opened
 * from. jsdom proves only the `inert` attribute: `web/e2e/cobroModal.spec.ts` proves in a
 * browser that nothing behind can be reached.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { router as appRouter } from '../../router'
import { CUSTOMER, CUSTOMER_PAYMENT, CUSTOMERS, HOME, pathTo, readPaymentUnderneath } from '../../routes'
import type { PaymentUnderneath, Viewport } from '../../routes'
import panelFixture from '../../api/fixtures/panel.json'
import { flipViewport, renderWithViewport } from '../../test-viewport'
import { inAppState } from '../../components/inAppState'

const ME = { email: 'a@b.com', business_name: 'Business', today: '2026-10-03' }
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
const CARD = pathTo(CUSTOMER, { id: 1 })
const PANEL = { 'GET /panel': () => jsonResponse(200, panelFixture) }

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

    const dialog = await screen.findByRole('dialog', { name: 'Record payment' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveTextContent('Ana Pérez · owes you $ 11.000 since 14/09')
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
    await screen.findByRole('dialog', { name: 'Record payment' })

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(router.state.location.pathname).toBe(CUSTOMERS))
  })

  test('the backdrop ends in the same leave', async () => {
    const router = renderApp([{ pathname: PAYMENT }], 'computer')
    await screen.findByRole('dialog', { name: 'Record payment' })

    const backdrop = document.querySelector<HTMLElement>('.cobro-modal')
    expect(backdrop).not.toBeNull()
    fireEvent.click(backdrop as HTMLElement)
    await waitFor(() => expect(router.state.location.pathname).toBe(CUSTOMERS))
  })

  test('with something typed, Escape asks first and does not leave', async () => {
    const router = renderApp([{ pathname: PAYMENT }], 'computer')
    await screen.findByRole('dialog', { name: 'Record payment' })
    await userEvent.click(await screen.findByRole('radio', { name: 'Cash' }))

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(await screen.findByText('Discard the payment?')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(PAYMENT)
    // A second Escape does nothing while the question shows.
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(router.state.location.pathname).toBe(PAYMENT)
  })
})

describe('on a phone', () => {
  test('Record payment is a modal dialog named by its title, with Close on top', async () => {
    renderApp([{ pathname: PAYMENT }], 'phone')

    const dialog = await screen.findByRole('dialog', { name: 'Record payment' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'New sale' })).toBeNull()
  })

  test('focus goes to the first field and Escape leaves like Close does', async () => {
    const router = renderApp([{ pathname: PAYMENT }], 'phone')
    const dialog = await screen.findByRole('dialog', { name: 'Record payment' })

    await waitFor(() => expect(within(dialog).getByLabelText('Amount')).toHaveFocus())
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(router.state.location.pathname).toBe(CUSTOMERS))
  })

  test('with something typed, Escape asks first and does not leave', async () => {
    const router = renderApp([{ pathname: PAYMENT }], 'phone')
    await screen.findByRole('dialog', { name: 'Record payment' })
    await userEvent.click(await screen.findByRole('radio', { name: 'Cash' }))

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(await screen.findByText('Discard the payment?')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(PAYMENT)
  })

  test('the sheet holds exactly one Close, and Save inside the form in its pinned actions', async () => {
    renderApp([{ pathname: PAYMENT }], 'phone')
    const dialog = await screen.findByRole('dialog', { name: 'Record payment' })

    expect(within(dialog).getAllByRole('button', { name: 'Close' })).toHaveLength(1)
    const save = within(dialog).getByRole('button', { name: 'Save' })
    expect(save.parentElement).toHaveClass('sheet__actions')
    expect(save.closest('form')?.lastElementChild).toBe(save.parentElement)
  })

  test('a flip across 900 px and back keeps the amount typed, with the form kept mounted', async () => {
    renderApp([{ pathname: PAYMENT }], 'phone')
    const amount = await screen.findByLabelText('Amount')
    await userEvent.clear(amount)
    await userEvent.type(amount, '5000')
    const form = amount.closest('form')

    flipViewport('computer')
    expect(screen.getByLabelText('Amount')).toHaveValue('$ 5.000')
    expect(screen.getByRole('dialog', { name: 'Record payment' })).not.toHaveClass('sheet__body')
    flipViewport('phone')

    expect(screen.getByLabelText('Amount')).toHaveValue('$ 5.000')
    expect(screen.getByLabelText('Amount').closest('form')).toBe(form)
  })

  test('the card alone is behind the form: no list beside it', async () => {
    renderApp([{ pathname: PAYMENT }], 'phone')

    expect(await screen.findByRole('button', { name: 'Save' })).toBeInTheDocument()
    await waitFor(() => expect(behindLink('Record payment')).not.toBeNull())
    expect(behindLink('Collect from Ana Pérez')).toBeNull()
    expect(behind()).toHaveLength(1)
  })
})

/** What sits behind the host: every `inert` element, each also `aria-hidden`. */
function behind(): HTMLElement[] {
  const inert = Array.from(document.querySelectorAll<HTMLElement>('[inert]'))
  for (const element of inert) expect(element).toHaveAttribute('aria-hidden', 'true')
  return inert
}

function behindLink(name: string): HTMLElement | null {
  for (const element of behind()) {
    const [link] = within(element).queryAllByRole('link', { name, hidden: true })
    if (link !== undefined) return link
  }
  return null
}

describe.each<Viewport>(['phone', 'computer'])('what sits behind Record payment, on a %s', (viewport) => {
  test('opened from Customers: the live list is behind, inert and aria-hidden', async () => {
    renderApp([{ pathname: HOME }, { pathname: CUSTOMERS }], viewport)
    await userEvent.click((await screen.findAllByRole('link', { name: 'Collect from Ana Pérez' }))[0]!)
    await screen.findByRole('radio', { name: 'Cash' })

    expect(behindLink('Collect from Ana Pérez')).not.toBeNull()
    expect(behind().some((element) => element.textContent?.includes('Customers') === true)).toBe(true)
    expect(behindLink('Record payment')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Ana Pérez' })).toBeNull()
  })

  test('opened from Home: the Today figures are behind, inert and aria-hidden', async () => {
    renderApp([{ pathname: HOME }], viewport, PANEL)
    await userEvent.click(await screen.findByRole('link', { name: 'Collect from Ana Pérez' }))
    await screen.findByRole('radio', { name: 'Cash' })

    await waitFor(() => expect(behindLink('Collect from Ana Pérez')).not.toBeNull())
    expect(screen.queryAllByRole('link', { name: 'Collect from Ana Pérez' })).toHaveLength(0)
  })

  test('opened from the card: the card is behind, and it shows no message of the entry before', async () => {
    const router = renderApp(
      [{ pathname: CARD, state: { ...inAppState({ pathname: CUSTOMERS }), toast: 'Customer saved' } }],
      viewport,
    )
    await userEvent.click(await screen.findByRole('link', { name: 'Record payment' }))
    await screen.findByRole('radio', { name: 'Cash' })

    expect(router.state.location.pathname).toBe(PAYMENT)
    const card = behindLink('Record payment')?.closest('[inert]')
    expect(card).toBeTruthy()
    expect(card).toHaveTextContent('Left owing')
    expect(card).not.toHaveTextContent('Customer saved')
  })

  test('with no state (a direct link or a reload) the card is behind', async () => {
    renderApp([{ pathname: PAYMENT }], viewport)
    await screen.findByRole('radio', { name: 'Cash' })

    await waitFor(() => expect(behindLink('Record payment')).not.toBeNull())
  })

  test('a state naming a screen outside the set puts the card behind', async () => {
    renderApp([{ pathname: PAYMENT, state: { underneath: 'sales' } }], viewport)
    await screen.findByRole('radio', { name: 'Cash' })

    await waitFor(() => expect(behindLink('Record payment')).not.toBeNull())
  })

  test.each<[PaymentUnderneath, string]>([
    ['customers', 'Collect from Ana Pérez'],
    ['card', 'Record payment'],
  ])('a customer that is gone, opened from %s: the host says so and the background does not navigate', async (underneath, link) => {
    const router = renderApp([{ pathname: PAYMENT, state: { underneath } }], viewport, {
      'GET /customers/1': () => jsonResponse(404, { code: 'customer.not_found' }),
      'GET /customers/1/account': () => jsonResponse(404, { code: 'customer.not_found' }),
    })

    expect(await screen.findByText('That is gone.', { selector: ':not([inert] *)' })).toBeInTheDocument()
    await waitFor(() => expect(behind().length).toBeGreaterThan(0))
    expect(router.state.location.pathname).toBe(PAYMENT)
    expect(screen.getByRole('link', { name: 'Back to Customers' })).toBeInTheDocument()
    if (underneath === 'customers') expect(behindLink(link)).not.toBeNull()
  })
})

describe('the link each screen follows to Record payment', () => {
  const cases: [string, PaymentUnderneath, { pathname: string }[], Record<string, () => Response>, string][] = [
    ['Customers', 'customers', [{ pathname: CUSTOMERS }], {}, 'Collect from Ana Pérez'],
    ['Home', 'home', [{ pathname: HOME }], PANEL, 'Collect from Ana Pérez'],
    ['the card', 'card', [{ pathname: CARD }], {}, 'Record payment'],
  ]
  test.each(cases)('%s carries its own screen name', async (_screenName, underneath, entries, answers, name) => {
    const router = renderApp(entries, 'computer', answers)
    await userEvent.click((await screen.findAllByRole('link', { name }))[0]!)

    expect(router.state.location.pathname).toBe(PAYMENT)
    expect(readPaymentUnderneath(router.state.location.state)).toBe(underneath)
    expect(router.state.location.state).toMatchObject({ underneath })
  })
})

describe.each<Viewport>(['phone', 'computer'])('opened from a list, on a %s', (viewport) => {
  test('from Clientes: a save lands on Clientes with the toast, and one back afterwards leaves', async () => {
    const router = renderApp([{ pathname: HOME }, { pathname: CUSTOMERS }], viewport)
    await userEvent.click((await screen.findAllByRole('link', { name: 'Collect from Ana Pérez' }))[0]!)
    await userEvent.click(await screen.findByRole('radio', { name: 'Cash' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(CUSTOMERS))
    expect(await screen.findByText('Payment saved · still owing $ 6.000')).toBeInTheDocument()
    await act(() => router.navigate(-1))
    expect(router.state.location.pathname).toBe(HOME)
  })

  test('from Inicio: a save lands on Inicio', async () => {
    const router = renderApp(
      [{ pathname: HOME }, { pathname: PAYMENT, state: inAppState({ pathname: HOME }) }],
      viewport,
      { 'GET /panel': () => jsonResponse(200, { debtors: [] }) },
    )
    await userEvent.click(await screen.findByRole('radio', { name: 'Cash' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(router.state.location.pathname).toBe(HOME))
  })
})

test('a customer answered as settled opens without an error, and the save is refused inline', async () => {
  renderApp([{ pathname: PAYMENT }], 'phone', {
    'GET /customers/1': () => jsonResponse(200, SETTLED),
    'POST /customers/1/payments': () => jsonResponse(422, { code: 'payment.above_balance' }),
  })

  const save = await screen.findByRole('button', { name: 'Save' })
  await userEvent.click(screen.getByRole('radio', { name: 'Cash' }))
  await userEvent.click(save)

  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Cash' })).toBeChecked()
})

test('a customer that is gone shows "That is gone." with a way back to Clientes', async () => {
  renderApp([{ pathname: PAYMENT }], 'phone', {
    'GET /customers/1': () => jsonResponse(404, { code: 'customer.not_found' }),
  })

  expect(await screen.findByText('That is gone.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to Customers' })).toBeInTheDocument()
})

describe('the form as drawn', () => {
  async function openForm(answers: Answers = {}) {
    const router = renderApp([{ pathname: PAYMENT }], 'phone', answers)
    await screen.findByRole('button', { name: 'Save' })
    return router
  }

  function postedBody(request: string): unknown {
    const call = vi
      .mocked(fetch)
      .mock.calls.find(([url, init]) => `${init?.method ?? 'GET'} ${url}` === request)
    return call === undefined ? undefined : JSON.parse(String(call[1]?.body))
  }

  test('opens showing the balance as whole pesos with dot thousands', async () => {
    await openForm()
    expect(screen.getByLabelText('Amount')).toHaveValue('$ 11.000')
  })

  test('a typed amount shows with dot thousands and the POST carries the number', async () => {
    await openForm()
    const amount = screen.getByLabelText('Amount')
    await userEvent.clear(amount)
    await userEvent.type(amount, '5000')
    expect(amount).toHaveValue('$ 5.000')

    await userEvent.click(screen.getByRole('radio', { name: 'Cash' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(postedBody('POST /customers/1/payments')).toBeDefined())
    expect(postedBody('POST /customers/1/payments')).toEqual({ paid_on: '2026-10-03', amount: 5000, method: 'cash' })
  })

  test('a zero amount is refused on save, an emptied one shows empty, and "All" brings the balance back', async () => {
    await openForm()
    const amount = screen.getByLabelText('Amount')
    await userEvent.clear(amount)
    expect(amount).toHaveValue('')
    await userEvent.type(amount, '0')
    expect(amount).toHaveValue('$ 0')
    await userEvent.click(screen.getByRole('radio', { name: 'Cash' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid amount')
    expect(postedBody('POST /customers/1/payments')).toBeUndefined()

    await userEvent.click(screen.getByRole('button', { name: 'All: $ 11.000' }))
    expect(amount).toHaveValue('$ 11.000')
  })

  test('an untouched form is not dirty: Close leaves without asking', async () => {
    const router = await openForm()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(CUSTOMERS))
    expect(screen.queryByText('Discard the payment?')).not.toBeInTheDocument()
  })

  test('the date is today with max = today, described as "Today dd/mm", then "dd/mm" for an earlier day', async () => {
    await openForm()
    const date = screen.getByLabelText('Date')
    expect(date).toHaveAttribute('type', 'date')
    expect(date).toHaveAttribute('max', '2026-10-03')
    expect(date).toBeRequired()
    expect(date).toHaveAccessibleDescription('Today 03/10')

    fireEvent.change(date, { target: { value: '2026-09-28' } })
    expect(date).toHaveAccessibleDescription('28/09')
  })

  test('one Backspace on the shown figure removes one digit, not the thousands', async () => {
    await openForm()
    const amount = screen.getByLabelText('Amount')
    await userEvent.type(amount, '{Backspace}')
    expect(amount).toHaveValue('$ 1.100')
  })

  test('a future-date refusal shows beside the date, and the date input points at it', async () => {
    await openForm({ 'POST /customers/1/payments': () => jsonResponse(422, { code: 'payment.future_date' }) })
    const date = screen.getByLabelText('Date')
    await userEvent.click(screen.getByRole('radio', { name: 'Cash' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The date cannot be in the future.')
    expect(date.getAttribute('aria-describedby')?.split(' ')).toContain(alert.id)
    expect(date).toHaveAccessibleDescription(/Today 03\/10.*The date cannot be in the future/)
  })

  test('the method is one radiogroup holding Cash and Transfer, none chosen', async () => {
    await openForm()
    const group = screen.getByRole('radiogroup', { name: 'Method' })
    expect(group).toHaveAttribute('aria-required', 'true')
    const radios = within(group).getAllByRole('radio')
    expect(radios.map((radio) => radio.textContent)).toEqual(['Cash', 'Transfer'])
    for (const radio of radios) expect(radio).toHaveAttribute('aria-checked', 'false')

    await userEvent.click(screen.getByRole('radio', { name: 'Transfer' }))
    expect(screen.getByRole('radio', { name: 'Transfer' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Cash' })).toHaveAttribute('aria-checked', 'false')
  })

  test('saving without a method shows the alert, and the group points at it', async () => {
    await openForm()
    const group = screen.getByRole('radiogroup', { name: 'Method' })
    expect(group).not.toHaveAttribute('aria-describedby')

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const alert = await screen.findByRole('alert')
    expect(group).toHaveAccessibleDescription(alert.textContent ?? '')
    expect(group.getAttribute('aria-describedby')).toBe(alert.id)
    expect(postedBody('POST /customers/1/payments')).toBeUndefined()
  })
})
