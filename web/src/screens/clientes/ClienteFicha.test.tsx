/**
 * `ClienteFicha` at the screen seam: a `gone` answer shows `GoneScreen` with
 * "Back to Customers", never a 403 or a hint of what the id actually is
 * (ADR-0004). "Nueva venta a <name>" (customers.md, "On screen (Clientes)")
 * opens the sale form with this customer chosen through `newSaleFor`, the state's
 * only writer (plan, invariants) — never the customer's name, which rides only in
 * the link's own visible text.
 *
 * The balance, "Record payment" and the account are the payments domain's own
 * answer (payments.md, "On screen"): this test fakes `GET /customers/:id` and
 * `GET /customers/:id/account` and checks the screen only ever shows what those
 * answers carry, branching on `standing` and a row's `kind` — never a sign on a
 * number.
 */

import { CUSTOMER, CUSTOMER_PAYMENT, CUSTOMERS, HOME, SALE_NEW, pathTo } from '../../routes'
import { inAppState } from '../../components/inAppState'
import { useGoneNotice } from '../../components/goneExit'
import { SheetRouterProvider } from '../../components/useSheetStack'
import { GONE_NOTICE } from '../../api/refusals'
import { stubViewport } from '../../test-viewport'
import { StrictMode } from 'react'
import { LIMITS, SAMPLES } from '../../copy/limits'
import { expectIconAndTextRule } from '../../test/iconAndTextRule'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outlet, useLocation } from 'react-router'
import { RouterProvider, createMemoryRouter } from 'react-router'
import FlashProvider from '../../flash/FlashProvider'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import accountFixture from '../../api/fixtures/account.json'
import paymentFixture from '../../api/fixtures/payment.json'
import paymentPreviewFixture from '../../api/fixtures/payment-preview.json'
import type { Me } from '../../api/me'
import { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import { readNewSaleState } from '../../components/feedback'
import { SIN_CONEXION_MENSAJE } from '../../copy/common'
import ClienteFicha from './ClienteFicha'
import CobroRoute from './CobroRoute'
import Shell from '../../shell/Shell'
import { stubFetchWithSettings } from '../stubFetchWithSettings'


const ME: Me = { email: 'a@b.com', business_name: 'Business', today: '2026-10-03' }

function Context() {
  return <Outlet context={ME} />
}

function NuevaVentaStub() {
  const location = useLocation()
  const customerId = readNewSaleState(location.state)
  return <span>Nueva venta para {customerId ?? 'nadie'}</span>
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function Flash() {
  return (
    <FlashProvider>
      <Context />
    </FlashProvider>
  )
}

function renderFicha(id: string, entries: string[] = [pathTo(CUSTOMER, { id })]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      {
        element: <Flash />,
        children: [
          { path: CUSTOMER, element: <ClienteFicha /> },
          { path: CUSTOMER_PAYMENT, element: <CobroRoute /> },
          { path: CUSTOMERS, element: <span>la lista</span> },
          { path: SALE_NEW, element: <NuevaVentaStub /> },
        ],
      },
    ],
    { initialEntries: entries },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

const SETTLED_CUSTOMER = {
  id: 3,
  name: 'Fer',
  phone: '+5491158423310',
  vip: true,
  balance: 0,
  owing_since: null,
  standing: 'settled',
}

const EMPTY_ACCOUNT = { balance: 0, owing_since: null, standing: 'settled', rows: [] }

function dispatchFetch(
  responses: Record<string, () => Response>,
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return (input, init) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = init?.method ?? 'GET'
    const key = `${method} ${url}`
    const makeResponse = responses[key]
    return Promise.resolve(makeResponse === undefined ? jsonResponse(404, {}) : makeResponse())
  }
}

let api: ReturnType<typeof stubFetchWithSettings>

beforeEach(() => {
  api = stubFetchWithSettings()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('a customer that is gone shows the gone screen, with a way back to the list', async () => {
  api.mockResolvedValue(
    jsonResponse(404, { detail: 'no such customer', code: 'customer.not_found' }),
  )
  renderFicha('999')

  expect(await screen.findByText('That is gone.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to Customers' })).toHaveAttribute(
    'href',
    CUSTOMERS,
  )
  expect(screen.queryByText(/999/)).not.toBeInTheDocument()
})

test('a settled customer shows their phone and VIP, no balance and no Registrar cobro', async () => {
  api.mockImplementation(
    dispatchFetch({
      'GET /customers/3': () => jsonResponse(200, SETTLED_CUSTOMER),
      'GET /customers/3/account': () => jsonResponse(200, EMPTY_ACCOUNT),
    }),
  )
  renderFicha('3')

  expect(await screen.findByText('+54 9 11 5842-3310')).toBeInTheDocument()
  expect(screen.queryByText(/telegram|whatsapp/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/te debe/i)).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Record payment' })).not.toBeInTheDocument()
})

const NO_PHONE_CUSTOMER = {
  id: 4,
  name: 'Caro',
  phone: null,
  vip: false,
  balance: 0,
  owing_since: null,
  standing: 'settled',
}

test('a customer with no phone shows no phone element, no dash, no empty label', async () => {
  api.mockImplementation(
    dispatchFetch({
      'GET /customers/4': () => jsonResponse(200, NO_PHONE_CUSTOMER),
      'GET /customers/4/account': () => jsonResponse(200, EMPTY_ACCOUNT),
    }),
  )
  renderFicha('4')

  await screen.findByText('Caro')
  expect(screen.queryByText('Phone')).not.toBeInTheDocument()
  expect(screen.queryByText('-')).not.toBeInTheDocument()
  expect(screen.queryByText('Sin teléfono')).not.toBeInTheDocument()
})

test('"Nueva venta a <name>" opens the sale form with this customer chosen, by id alone', async () => {
  api.mockImplementation(
    dispatchFetch({
      'GET /customers/3': () => jsonResponse(200, SETTLED_CUSTOMER),
      'GET /customers/3/account': () => jsonResponse(200, EMPTY_ACCOUNT),
    }),
  )
  renderFicha('3')

  const link = await screen.findByRole('link', { name: 'New sale to Fer' })
  expect(link).toHaveAttribute('href', SALE_NEW)
  await userEvent.click(link)

  expect(await screen.findByText('Nueva venta para 3')).toBeInTheDocument()
})

test('on a computer the customer\'s card under the real shell keeps "Nueva venta a <name>" and the rail has no "+ Nueva venta"', async () => {
  stubViewport('computer')
  api.mockImplementation(
    dispatchFetch({
      'GET /customers/3': () => jsonResponse(200, SETTLED_CUSTOMER),
      'GET /customers/3/account': () => jsonResponse(200, EMPTY_ACCOUNT),
    }),
  )
  const router = createMemoryRouter(
    [
      {
        element: <Flash />,
        children: [
          {
            element: <Shell />,
            children: [{ path: CUSTOMER, handle: { screen: 'customer' }, element: <ClienteFicha /> }],
          },
        ],
      },
    ],
    { initialEntries: [pathTo(CUSTOMER, { id: 3 })] },
  )
  const { container } = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )

  expect(await screen.findByRole('link', { name: 'New sale to Fer' })).toHaveAttribute('href', SALE_NEW)
  const rail = container.querySelector('.riel-lateral') as HTMLElement
  expect(within(rail).queryByRole('link', { name: /^New sale/ })).not.toBeInTheDocument()
})

const OWING_CUSTOMER = {
  id: 1,
  name: 'Ana',
  phone: '+5491122334455',
  vip: false,
  balance: 11000,
  owing_since: '2026-09-14',
  standing: 'owes',
}

const OWING_ACCOUNT = {
  balance: 11000,
  owing_since: '2026-09-14',
  standing: 'owes',
  rows: [
    {
      kind: 'sale',
      date: '2026-09-14',
      running_balance: 11000,
      standing: 'owes',
      sale: { id: 10, total: 11000, how_paid: 'owing' },
    },
  ],
}

test('a customer who owes shows "Te debe" since the oldest debt, Registrar cobro, and the account row', async () => {
  api.mockImplementation(
    dispatchFetch({
      'GET /customers/1': () => jsonResponse(200, OWING_CUSTOMER),
      'GET /customers/1/account': () => jsonResponse(200, OWING_ACCOUNT),
    }),
  )
  renderFicha('1')

  expect(await screen.findByText('Owes you $ 11.000')).toBeInTheDocument()
  expect(screen.getByText('since 14/09')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Record payment' })).toBeInTheDocument()
  expect(await screen.findByText('Left owing')).toBeInTheDocument()
})

const CREDIT_CUSTOMER = {
  id: 2,
  name: 'Lu',
  phone: '+5491100000000',
  vip: false,
  balance: -2000,
  owing_since: null,
  standing: 'credit',
}

test('a customer in credit shows "A favor", never "Te debe", and no Registrar cobro', async () => {
  api.mockImplementation(
    dispatchFetch({
      'GET /customers/2': () => jsonResponse(200, CREDIT_CUSTOMER),
      'GET /customers/2/account': () => jsonResponse(200, { ...EMPTY_ACCOUNT, balance: -2000, standing: 'credit' }),
    }),
  )
  renderFicha('2')

  expect(await screen.findByText('Credit $ 2.000')).toBeInTheDocument()
  expect(screen.queryByText(/te debe/i)).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Record payment' })).not.toBeInTheDocument()
})

test('the account labels a sale, a later payment\'s split and its leftover credit row only from kind/standing, never a sign on a number', async () => {
  // `account.json` (plan, invariants: "used by the front's fetch fakes") is the
  // one case on this branch with all three row kinds together: a sale left
  // owing, a later payment's split, and the credit left over once every debt is
  // settled. `CREDIT_CUSTOMER`'s own balance/standing match the fixture's
  // overall balance, so the card and the account agree.
  api.mockImplementation(
    dispatchFetch({
      'GET /customers/2': () => jsonResponse(200, CREDIT_CUSTOMER),
      'GET /customers/2/account': () => jsonResponse(200, accountFixture),
    }),
  )
  renderFicha('2')

  await screen.findByText('Left owing')
  const account = document.querySelector('.cuenta-cliente')
  expect(account).not.toBeNull()
  const inAccount = within(account as HTMLElement)
  expect(inAccount.getByText('Payment · cash · On account of the sale of 14/09')).toBeInTheDocument()
  expect(inAccount.getByText('Credit')).toBeInTheDocument()

  // Each row shows its own figure (`.cuenta-cliente__monto`) next to the running
  // balance it left (`.cuenta-cliente__saldo`) — plan, "On screen": "with the
  // amount applied to that sale" — never only the running balance (review
  // finding). The sale row's own total and its running balance happen to be the
  // same figure here (nothing had been paid against it yet), so the two are read
  // from their own class, not by text, to tell them apart.
  const filas = Array.from(account?.querySelectorAll('.cuenta-cliente__fila') ?? [])
  expect(filas).toHaveLength(4)
  const [saleFila, firstPaymentFila, secondPaymentFila, creditFila] = filas
  if (
    saleFila === undefined ||
    firstPaymentFila === undefined ||
    secondPaymentFila === undefined ||
    creditFila === undefined
  ) {
    throw new Error('expected four account rows')
  }
  expect(saleFila.querySelector('.cuenta-cliente__monto')).toHaveTextContent('$ 11.000')
  expect(saleFila.querySelector('.cuenta-cliente__saldo')).toHaveTextContent('saldo $ 11.000')
  // The first payment's own amount ($ 5.000, what it applied to the 14/09 sale)
  // differs from what it then left owing ($ 6.000) — exactly the figure the
  // review found missing.
  expect(firstPaymentFila.querySelector('.cuenta-cliente__monto')).toHaveTextContent('$ 5.000')
  expect(firstPaymentFila.querySelector('.cuenta-cliente__saldo')).toHaveTextContent('saldo $ 6.000')
  // The second payment (id 6, $ 8.000 in all) finishes off the 14/09 sale's
  // remaining $ 6.000 — its own split row, before its leftover becomes the
  // credit row below (plan, "Account": "a credit row ... right after that
  // payment's splits"; review finding: this split row was missing from the
  // fixture, leaving the credit jump from $ 6.000 straight to -$ 2.000 with no
  // row accounting for the $ 6.000 in between).
  expect(secondPaymentFila.querySelector('.cuenta-cliente__monto')).toHaveTextContent('$ 6.000')
  expect(secondPaymentFila.querySelector('.cuenta-cliente__saldo')).toHaveTextContent('saldo $ 0')
  // The credit row's own leftover ($ 2.000) and the running balance it leaves
  // (also "A favor $ 2.000" here) both drop their sign, picked only by `kind`/
  // `standing`, never a comparison on the number itself.
  expect(creditFila.querySelector('.cuenta-cliente__monto')).toHaveTextContent('$ 2.000')
  expect(creditFila.querySelector('.cuenta-cliente__saldo')).toHaveTextContent('Credit $ 2.000')
})

test('Delete payment asks before deleting, then shows "Payment deleted" and refreshes the account', async () => {
  let deleted = false
  api.mockImplementation(
    dispatchFetch({
      'GET /customers/1': () => jsonResponse(200, deleted ? SETTLED_CUSTOMER : OWING_CUSTOMER),
      'GET /customers/1/account': () =>
        jsonResponse(
          200,
          deleted
            ? EMPTY_ACCOUNT
            : {
                balance: 6000,
                owing_since: '2026-09-14',
                standing: 'owes',
                rows: [
                  {
                    kind: 'payment',
                    date: '2026-09-20',
                    running_balance: 6000,
                    standing: 'owes',
                    payment: { id: 5, paid_on: '2026-09-20', amount: 5000, method: 'cash' },
                    applied_to: { sale_id: 10, sale_date: '2026-09-14', amount: 5000 },
                  },
                ],
              },
        ),
      'DELETE /payments/5': () => {
        deleted = true
        return new Response(null, { status: 204 })
      },
    }),
  )
  renderFicha('1')

  const borrar = await screen.findByRole('button', { name: 'Delete payment' })
  await userEvent.click(borrar)

  expect(
    screen.getByText('¿Borrás el cobro de $ 5.000 (efectivo) del 20/09?'),
  ).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }))

  await waitFor(() =>
    expect(api).toHaveBeenCalledWith('/payments/5', expect.objectContaining({ method: 'DELETE' })),
  )
  expect(await screen.findByText('Payment deleted')).toBeInTheDocument()
})

const CREDIT_ONLY_CUSTOMER = {
  ...SETTLED_CUSTOMER,
  id: 1,
  name: 'Ana',
  balance: -44000,
  standing: 'credit',
}

const CREDIT_ONLY_ACCOUNT = {
  balance: -44000,
  owing_since: null,
  standing: 'credit',
  rows: [
    {
      kind: 'credit',
      date: '2026-10-06',
      running_balance: -44000,
      standing: 'credit',
      payment: { id: 7, paid_on: '2026-10-06', amount: 44000, method: 'cash' },
      amount: 44000,
    },
  ],
}

test('a payment that shows only as "A favor" offers Delete payment, and deleting it brings the balance back to nothing', async () => {
  let deleted = false
  api.mockImplementation(
    dispatchFetch({
      'GET /customers/1': () => jsonResponse(200, deleted ? SETTLED_CUSTOMER : CREDIT_ONLY_CUSTOMER),
      'GET /customers/1/account': () => jsonResponse(200, deleted ? EMPTY_ACCOUNT : CREDIT_ONLY_ACCOUNT),
      'DELETE /payments/7': () => {
        deleted = true
        return new Response(null, { status: 204 })
      },
    }),
  )
  renderFicha('1')

  const borrar = await screen.findByRole('button', { name: 'Delete payment' })
  expect(screen.getAllByRole('button', { name: 'Delete payment' })).toHaveLength(1)
  await userEvent.click(borrar)

  expect(
    screen.getByText('¿Borrás el cobro de $ 44.000 (efectivo) del 06/10?'),
  ).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }))

  expect(await screen.findByText('Payment deleted')).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByText(/Credit/)).not.toBeInTheDocument())
  expect(screen.queryByText(/Owes you/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Delete payment' })).not.toBeInTheDocument()
})

test('Delete payment on a credit-only payment already gone closes the dialog and shows the gone notice', async () => {
  api.mockImplementation(
    dispatchFetch({
      'GET /customers/1': () => jsonResponse(200, CREDIT_ONLY_CUSTOMER),
      'GET /customers/1/account': () => jsonResponse(200, CREDIT_ONLY_ACCOUNT),
      'DELETE /payments/7': () => jsonResponse(404, { code: 'payment.not_found' }),
    }),
  )
  renderFicha('1')

  await userEvent.click(await screen.findByRole('button', { name: 'Delete payment' }))
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }))

  expect(await screen.findByText('That is gone. The list is up to date.')).toBeInTheDocument()
  expect(screen.queryByText('¿Borrás el cobro de $ 44.000 (efectivo) del 06/10?')).not.toBeInTheDocument()
  expect(screen.queryByText('Payment deleted')).not.toBeInTheDocument()
})

test('a payment split between a sale and a credit offers one Delete payment, on its payment row', async () => {
  api.mockImplementation(
    dispatchFetch({
      'GET /customers/1': () => jsonResponse(200, CREDIT_ONLY_CUSTOMER),
      'GET /customers/1/account': () =>
        jsonResponse(200, {
          balance: -3000,
          owing_since: null,
          standing: 'credit',
          rows: [
            {
              kind: 'sale',
              date: '2026-10-01',
              running_balance: 5000,
              standing: 'owes',
              sale: { id: 10, total: 5000, how_paid: 'owing' },
            },
            {
              kind: 'payment',
              date: '2026-10-05',
              running_balance: 0,
              standing: 'settled',
              payment: { id: 8, paid_on: '2026-10-05', amount: 8000, method: 'cash' },
              applied_to: { sale_id: 10, sale_date: '2026-10-01', amount: 5000 },
            },
            {
              kind: 'credit',
              date: '2026-10-05',
              running_balance: -3000,
              standing: 'credit',
              payment: { id: 8, paid_on: '2026-10-05', amount: 8000, method: 'cash' },
              amount: 3000,
            },
          ],
        }),
    }),
  )
  renderFicha('1')

  await screen.findByRole('button', { name: 'Delete payment' })
  expect(screen.getAllByRole('button', { name: 'Delete payment' })).toHaveLength(1)
  const filas = Array.from(document.querySelectorAll<HTMLElement>('.cuenta-cliente__fila'))
  expect(filas).toHaveLength(3)
  const [saleFila, paymentFila, creditFila] = filas
  if (saleFila === undefined || paymentFila === undefined || creditFila === undefined) {
    throw new Error('expected three account rows')
  }
  expect(within(saleFila).queryByRole('button', { name: 'Delete payment' })).not.toBeInTheDocument()
  expect(within(paymentFila).getByRole('button', { name: 'Delete payment' })).toBeInTheDocument()
  expect(within(creditFila).queryByRole('button', { name: 'Delete payment' })).not.toBeInTheDocument()
})

test('a sale paid on the spot offers no Delete payment', async () => {
  api.mockImplementation(
    dispatchFetch({
      'GET /customers/1': () => jsonResponse(200, SETTLED_CUSTOMER),
      'GET /customers/1/account': () =>
        jsonResponse(200, {
          balance: 0,
          owing_since: null,
          standing: 'settled',
          rows: [
            {
              kind: 'sale',
              date: '2026-10-01',
              running_balance: 0,
              standing: 'settled',
              sale: { id: 10, total: 5000, how_paid: 'cash' },
            },
          ],
        }),
    }),
  )
  renderFicha('1')

  expect(await screen.findByText('Paid in cash')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Delete payment' })).not.toBeInTheDocument()
})

test('registering a payment shows "Payment saved · still owing $ X" when something remains', async () => {
  api.mockImplementation(
    dispatchFetch({
      'GET /customers/1': () => jsonResponse(200, OWING_CUSTOMER),
      'GET /customers/1/account': () => jsonResponse(200, OWING_ACCOUNT),
      'POST /customers/1/payments': () => jsonResponse(201, paymentFixture),
    }),
  )
  renderFicha('1')

  await userEvent.click(await screen.findByRole('link', { name: 'Record payment' }))
  const sheet = (await screen.findByRole('button', { name: 'Save' })).closest('form')
  expect(sheet).not.toBeNull()
  await userEvent.clear(within(sheet as HTMLElement).getByLabelText('Amount'))
  await userEvent.type(within(sheet as HTMLElement).getByLabelText('Amount'), '5000')
  await userEvent.click(within(sheet as HTMLElement).getByLabelText('Cash'))
  await userEvent.click(within(sheet as HTMLElement).getByRole('button', { name: 'Save' }))

  // `payment.json`'s own `after.balance` (plan, invariants: "used by the front's
  // fetch fakes").
  expect(await screen.findByText('Payment saved · still owing $ 6.000')).toBeInTheDocument()
})

test('"Todo" fills the amount with the balance, and the debounced preview shows the splits and what is left', async () => {
  api.mockImplementation(
    dispatchFetch({
      'GET /customers/1': () => jsonResponse(200, OWING_CUSTOMER),
      'GET /customers/1/account': () => jsonResponse(200, OWING_ACCOUNT),
      'POST /customers/1/payments/preview': () =>
        jsonResponse(200, {
          applied_to: [{ sale_id: 10, sale_date: '2026-09-14', amount: 11000 }],
          after: { balance: 0, owing_since: null, standing: 'settled' },
        }),
    }),
  )
  renderFicha('1')

  await userEvent.click(await screen.findByRole('link', { name: 'Record payment' }))
  const sheet = (await screen.findByRole('button', { name: 'Save' })).closest('form')
  expect(sheet).not.toBeNull()
  const within_ = within(sheet as HTMLElement)

  await userEvent.click(within_.getByRole('button', { name: 'All: $ 11.000' }))
  expect(within_.getByLabelText('Amount')).toHaveValue('11000')

  expect(await within_.findByText('Taken from the oldest debt')).toBeInTheDocument()
  expect(await within_.findByText('$ 11.000 a la venta del 14/09')).toBeInTheDocument()
  expect(within_.queryByText(/They still owe/)).not.toBeInTheDocument()
})

test('a partial amount\'s preview shows "They still owe $ X", from the preview\'s own after.balance', async () => {
  api.mockImplementation(
    dispatchFetch({
      'GET /customers/1': () => jsonResponse(200, OWING_CUSTOMER),
      'GET /customers/1/account': () => jsonResponse(200, OWING_ACCOUNT),
      // `payment-preview.json` (plan, invariants: "used by the front's fetch
      // fakes"): a 5000 split off the 14/09 sale, 6000 left owing.
      'POST /customers/1/payments/preview': () => jsonResponse(200, paymentPreviewFixture),
    }),
  )
  renderFicha('1')

  await userEvent.click(await screen.findByRole('link', { name: 'Record payment' }))
  const sheet = (await screen.findByRole('button', { name: 'Save' })).closest('form')
  expect(sheet).not.toBeNull()
  const within_ = within(sheet as HTMLElement)

  await userEvent.clear(within_.getByLabelText('Amount'))
  await userEvent.type(within_.getByLabelText('Amount'), '5000')

  expect(await within_.findByText('$ 5.000 a la venta del 14/09')).toBeInTheDocument()
  expect(await within_.findByText('They still owe $ 6.000')).toBeInTheDocument()
})

test('registering a payment that settles everything shows the plain "Payment saved" toast', async () => {
  api.mockImplementation(
    dispatchFetch({
      'GET /customers/1': () => jsonResponse(200, OWING_CUSTOMER),
      'GET /customers/1/account': () => jsonResponse(200, OWING_ACCOUNT),
      'POST /customers/1/payments': () =>
        jsonResponse(201, {
          payment: { id: 5, paid_on: '2026-10-03', amount: 11000, method: 'cash' },
          applied_to: [{ sale_id: 10, sale_date: '2026-09-14', amount: 11000 }],
          after: { balance: 0, owing_since: null, standing: 'settled' },
        }),
    }),
  )
  renderFicha('1')

  await userEvent.click(await screen.findByRole('link', { name: 'Record payment' }))
  const sheet = (await screen.findByRole('button', { name: 'Save' })).closest('form')
  expect(sheet).not.toBeNull()
  await userEvent.click(within(sheet as HTMLElement).getByRole('button', { name: 'All: $ 11.000' }))
  await userEvent.click(within(sheet as HTMLElement).getByLabelText('Cash'))
  await userEvent.click(within(sheet as HTMLElement).getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('Payment saved')).toBeInTheDocument()
  expect(screen.queryByText(/still owing/)).not.toBeInTheDocument()
})

test('a payment deleted by a partner meanwhile shows the gone notice, never the generic retry', async () => {
  api.mockImplementation(
    dispatchFetch({
      'GET /customers/1': () => jsonResponse(200, OWING_CUSTOMER),
      'GET /customers/1/account': () =>
        jsonResponse(200, {
          balance: 6000,
          owing_since: '2026-09-14',
          standing: 'owes',
          rows: [
            {
              kind: 'payment',
              date: '2026-09-20',
              running_balance: 6000,
              standing: 'owes',
              payment: { id: 5, paid_on: '2026-09-20', amount: 5000, method: 'cash' },
              applied_to: { sale_id: 10, sale_date: '2026-09-14', amount: 5000 },
            },
          ],
        }),
      'DELETE /payments/5': () => jsonResponse(404, { code: 'payment.not_found' }),
    }),
  )
  renderFicha('1')

  const borrar = await screen.findByRole('button', { name: 'Delete payment' })
  await userEvent.click(borrar)
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }))

  expect(await screen.findByText('That is gone. The list is up to date.')).toBeInTheDocument()
  expect(screen.queryByText('Payment deleted')).not.toBeInTheDocument()
})

const ACCOUNT_WITH_ONE_PAYMENT = {
  balance: 6000,
  owing_since: '2026-09-14',
  standing: 'owes',
  rows: [
    {
      kind: 'payment',
      date: '2026-09-20',
      running_balance: 6000,
      standing: 'owes',
      payment: { id: 5, paid_on: '2026-09-20', amount: 5000, method: 'cash' },
      applied_to: { sale_id: 10, sale_date: '2026-09-14', amount: 5000 },
    },
  ],
}

test('Delete payment when the connection drops shows "Sin conexión", never the generic retry or the gone notice', async () => {
  const base = dispatchFetch({
    'GET /customers/1': () => jsonResponse(200, OWING_CUSTOMER),
    'GET /customers/1/account': () => jsonResponse(200, ACCOUNT_WITH_ONE_PAYMENT),
  })
  // Same mechanism `client.test.ts` uses to turn a dropped connection into a
  // `NetworkError`: the fetch mock rejects, never resolves with a response.
  api.mockImplementation((input, init) => {
    const method = init?.method ?? 'GET'
    if (method === 'DELETE') return Promise.reject(new TypeError('Failed to fetch'))
    return base(input, init)
  })
  renderFicha('1')

  const borrar = await screen.findByRole('button', { name: 'Delete payment' })
  await userEvent.click(borrar)
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }))

  expect(await screen.findByText(SIN_CONEXION_MENSAJE)).toBeInTheDocument()
  expect(screen.queryByText(ERROR_GENERICO_MENSAJE)).not.toBeInTheDocument()
  expect(screen.queryByText('That is gone. The list is up to date.')).not.toBeInTheDocument()
  expect(screen.queryByText('Payment deleted')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Delete payment' })).toBeInTheDocument()
})

test('Delete payment refused for a reason other than "gone" shows the generic retry, never "Sin conexión" or the gone notice', async () => {
  api.mockImplementation(
    dispatchFetch({
      'GET /customers/1': () => jsonResponse(200, OWING_CUSTOMER),
      'GET /customers/1/account': () => jsonResponse(200, ACCOUNT_WITH_ONE_PAYMENT),
      'DELETE /payments/5': () =>
        jsonResponse(409, { detail: 'ya se cobró al momento', code: 'payment.on_the_spot' }),
    }),
  )
  renderFicha('1')

  const borrar = await screen.findByRole('button', { name: 'Delete payment' })
  await userEvent.click(borrar)
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }))

  expect(await screen.findByText(ERROR_GENERICO_MENSAJE)).toBeInTheDocument()
  expect(screen.queryByText(SIN_CONEXION_MENSAJE)).not.toBeInTheDocument()
  expect(screen.queryByText('That is gone. The list is up to date.')).not.toBeInTheDocument()
  expect(screen.queryByText('Payment deleted')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Delete payment' })).toBeInTheDocument()
})

test('a payment above the balance shows the fixed refusal inline and keeps what was typed', async () => {
  api.mockImplementation(
    dispatchFetch({
      'GET /customers/1': () => jsonResponse(200, OWING_CUSTOMER),
      'GET /customers/1/account': () => jsonResponse(200, OWING_ACCOUNT),
      'POST /customers/1/payments': () => jsonResponse(422, { code: 'payment.above_balance' }),
    }),
  )
  renderFicha('1')

  await userEvent.click(await screen.findByRole('link', { name: 'Record payment' }))
  const sheet = (await screen.findByRole('button', { name: 'Save' })).closest('form')
  expect(sheet).not.toBeNull()
  await userEvent.clear(within(sheet as HTMLElement).getByLabelText('Amount'))
  await userEvent.type(within(sheet as HTMLElement).getByLabelText('Amount'), '999000')
  await userEvent.click(within(sheet as HTMLElement).getByLabelText('Cash'))
  await userEvent.click(within(sheet as HTMLElement).getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('The amount is more than they owe you.')).toBeInTheDocument()
  expect(within(sheet as HTMLElement).getByLabelText('Amount')).toHaveValue('999000')
})

const OWING_FETCHES = {
  'GET /customers/1': () => jsonResponse(200, OWING_CUSTOMER),
  'GET /customers/1/account': () => jsonResponse(200, OWING_ACCOUNT),
}

test('the payment route opens the sheet by itself, from a typed address, and Cerrar leaves to Clientes, its parent', async () => {
  api.mockImplementation(dispatchFetch(OWING_FETCHES))
  const router = renderFicha('1', [pathTo(CUSTOMER_PAYMENT, { id: 1 })])

  expect(await screen.findByRole('button', { name: 'Save' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  await waitFor(() => expect(router.state.location.pathname).toBe(CUSTOMERS))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument())
})

test('an untouched sheet leaves at once on history back', async () => {
  api.mockImplementation(dispatchFetch(OWING_FETCHES))
  const router = renderFicha('1')
  await userEvent.click(await screen.findByRole('link', { name: 'Record payment' }))
  await screen.findByRole('button', { name: 'Save' })

  await act(() => router.navigate(-1))

  await waitFor(() => expect(router.state.location.pathname).toBe(pathTo(CUSTOMER, { id: 1 })))
  expect(screen.queryByText('Discard the payment?')).not.toBeInTheDocument()
})

test('a touched sheet asks before history back leaves, "No" keeps what was typed and "Sí" leaves to Clientes, its parent', async () => {
  api.mockImplementation(dispatchFetch(OWING_FETCHES))
  const router = renderFicha('1', [pathTo(CUSTOMER, { id: 1 }), pathTo(CUSTOMER_PAYMENT, { id: 1 })])
  await userEvent.click(await screen.findByLabelText('Cash'))
  await act(() => router.navigate(-1))

  expect(await screen.findByText('Discard the payment?')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(pathTo(CUSTOMER_PAYMENT, { id: 1 }))
  await userEvent.click(screen.getByRole('button', { name: 'No, keep entering' }))
  // React takes the dialog off the screen after the click, not inside it: wait for it
  // before reading anything else (`waitFor`, not `waitForElementToBeRemoved`, which
  // throws when the element is already gone).
  await waitFor(() => expect(screen.queryByText('Discard the payment?')).not.toBeInTheDocument())
  // A regression check that "No" did not navigate, not a sync point.
  await waitFor(() => expect(router.state.location.pathname).toBe(pathTo(CUSTOMER_PAYMENT, { id: 1 })))
  expect(await screen.findByLabelText('Cash')).toBeChecked()

  await userEvent.click(await screen.findByRole('button', { name: 'Close' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Yes, discard it' }))
  await waitFor(() => expect(router.state.location.pathname).toBe(CUSTOMERS))
})

test('after a save the sheet is not in history: back from the card goes to what was before it', async () => {
  api.mockImplementation(
    dispatchFetch({
      ...OWING_FETCHES,
      'POST /customers/1/payments': () => jsonResponse(201, paymentFixture),
    }),
  )
  const router = renderFicha('1', [CUSTOMERS, pathTo(CUSTOMER, { id: 1 })])
  await router.navigate(CUSTOMERS)
  await router.navigate(pathTo(CUSTOMER, { id: 1 }), { state: inAppState({ pathname: CUSTOMERS }) })
  await userEvent.click(await screen.findByRole('link', { name: 'Record payment' }))
  await userEvent.click(await screen.findByLabelText('Cash'))
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(router.state.location.pathname).toBe(pathTo(CUSTOMER, { id: 1 })))
  expect(await screen.findByText('Payment saved · still owing $ 6.000')).toBeInTheDocument()
  await router.navigate(-1)
  await waitFor(() => expect(router.state.location.pathname).toBe(CUSTOMERS))
})

// The gone exit of "Record payment" (navigation.md, "A gone exit is the same move as
// Cerrar"): its registered parent is Clientes.
type HistoryEntry = string | { pathname: string; state: unknown }

function ListWithNotice() {
  const goneShown = useGoneNotice()
  return (
    <div>
      <span>la lista</span>
      {goneShown && <span>{GONE_NOTICE}</span>}
    </div>
  )
}

function fakeGonePayment() {
  api.mockImplementation(
    dispatchFetch({
      ...OWING_FETCHES,
      'POST /customers/1/payments': () =>
        jsonResponse(404, { detail: 'no such customer', code: 'payment.customer_not_found' }),
    }),
  )
}

/** The real data router under StrictMode, with the router handle the gone notice follows. */
function renderGone(entries: HistoryEntry[]) {
  const router = createMemoryRouter(
    [
      {
        element: <Flash />,
        children: [
          { path: CUSTOMER, element: <ClienteFicha /> },
          { path: CUSTOMER_PAYMENT, element: <CobroRoute /> },
          { path: CUSTOMERS, element: <ListWithNotice /> },
          { path: HOME, element: <span>Inicio</span> },
        ],
      },
    ],
    { initialEntries: entries, initialIndex: entries.length - 1 },
  )
  const app = (
    <StrictMode>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SheetRouterProvider router={router}>
          <RouterProvider router={router} />
        </SheetRouterProvider>
      </QueryClientProvider>
    </StrictMode>
  )
  const view = render(app)
  return { router, view, app }
}

async function saveTheGonePayment() {
  await userEvent.click(await screen.findByLabelText('Cash'))
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
}

const PAYMENT = pathTo(CUSTOMER_PAYMENT, { id: 1 })

test('a gone cobro opened from Clientes goes back to it: Clientes is in history once, with the notice once', async () => {
  fakeGonePayment()
  const { router } = renderGone([HOME, CUSTOMERS, { pathname: PAYMENT, state: inAppState({ pathname: CUSTOMERS }) }])

  await saveTheGonePayment()

  expect(await screen.findByText('la lista')).toBeInTheDocument()
  expect(router.state.historyAction).toBe('POP')
  expect(screen.getAllByText(GONE_NOTICE)).toHaveLength(1)
  await act(() => router.navigate(-1))
  await waitFor(() => expect(router.state.location.pathname).toBe(HOME))
  await waitFor(() => expect(screen.queryByText(GONE_NOTICE)).not.toBeInTheDocument())
})

test("a gone cobro opened from Inicio's teaser replaces the sheet with Clientes and leaves Inicio alone", async () => {
  fakeGonePayment()
  const { router } = renderGone([HOME, { pathname: PAYMENT, state: inAppState({ pathname: HOME }) }])

  await saveTheGonePayment()

  expect(await screen.findByText('la lista')).toBeInTheDocument()
  expect(router.state.historyAction).toBe('REPLACE')
  expect(screen.getAllByText(GONE_NOTICE)).toHaveLength(1)
  await act(() => router.navigate(-1))
  await waitFor(() => expect(router.state.location.pathname).toBe(HOME))
  await waitFor(() => expect(screen.queryByText(GONE_NOTICE)).not.toBeInTheDocument())
})

test('a gone cobro on a direct link replaces the sheet with Clientes and shows the notice', async () => {
  fakeGonePayment()
  const { router } = renderGone([PAYMENT])

  await saveTheGonePayment()

  expect(await screen.findByText('la lista')).toBeInTheDocument()
  expect(router.state.historyAction).toBe('REPLACE')
  expect(screen.getAllByText(GONE_NOTICE)).toHaveLength(1)
})

test('after a reload of the sheet, the gone exit still goes back once', async () => {
  fakeGonePayment()
  const { router, view, app } = renderGone([HOME, CUSTOMERS, { pathname: PAYMENT, state: inAppState({ pathname: CUSTOMERS }) }])
  await screen.findByLabelText('Cash')
  view.unmount()
  render(app)

  await saveTheGonePayment()

  expect(await screen.findByText('la lista')).toBeInTheDocument()
  expect(router.state.historyAction).toBe('POP')
  expect(screen.getAllByText(GONE_NOTICE)).toHaveLength(1)
})

test('a resize across 900 px between opening and leaving does not change where the exit goes', async () => {
  fakeGonePayment()
  stubViewport('phone')
  const { router } = renderGone([HOME, CUSTOMERS, { pathname: PAYMENT, state: inAppState({ pathname: CUSTOMERS }) }])
  await screen.findByLabelText('Cash')
  stubViewport('computer')

  await saveTheGonePayment()

  expect(await screen.findByText('la lista')).toBeInTheDocument()
  expect(router.state.historyAction).toBe('POP')
})

test.each([
  ['a query string', `${CUSTOMERS}?q=fer`],
  ['a trailing slash', `${CUSTOMERS}/`],
])('a from with %s still counts as the parent: the exit goes back', async (_name, from) => {
  fakeGonePayment()
  const { router } = renderGone([HOME, CUSTOMERS, { pathname: PAYMENT, state: inAppState({ pathname: from }) }])

  await saveTheGonePayment()

  expect(await screen.findByText('la lista')).toBeInTheDocument()
  expect(router.state.historyAction).toBe('POP')
  expect(screen.getAllByText(GONE_NOTICE)).toHaveLength(1)
})

const RULE = { limits: LIMITS, samples: { name: SAMPLES.name } }

test('the card and its form follow the icon and text rule: Delete payment is icon-only, the rest keep their words', async () => {
  api.mockImplementation(
    dispatchFetch({
      'GET /customers/1': () => jsonResponse(200, OWING_CUSTOMER),
      'GET /customers/1/account': () =>
        jsonResponse(200, {
          balance: 6000,
          owing_since: '2026-09-14',
          standing: 'owes',
          rows: [
            {
              kind: 'payment',
              date: '2026-09-20',
              running_balance: 6000,
              standing: 'owes',
              payment: { id: 5, paid_on: '2026-09-20', amount: 5000, method: 'cash' },
              applied_to: { sale_id: 10, sale_date: '2026-09-14', amount: 5000 },
            },
          ],
        }),
    }),
  )
  renderFicha('1')

  const borrar = await screen.findByRole('button', { name: 'Delete payment' })
  expect(borrar).toHaveClass('boton-icono')
  expect(borrar).toHaveTextContent('')
  expect(borrar.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  const registrar = screen.getByRole('link', { name: 'Record payment' })
  expect(registrar.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  const nueva = screen.getByRole('link', { name: /^New sale to / })
  expect(nueva.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expectIconAndTextRule(document.body, RULE)

  await userEvent.click(registrar)
  await screen.findByRole('button', { name: 'Save' })
  expectIconAndTextRule(document.body, RULE)
})
