/**
 * `ClienteFicha` at the screen seam: a `gone` answer shows `GoneScreen` with
 * "Volver a Clientes", never a 403 or a hint of what the id actually is
 * (ADR-0004). "Nueva venta a <name>" (customers.md, "On screen (Clientes)")
 * opens the sale form with this customer chosen through `newSaleFor`, the state's
 * only writer (plan, invariants) — never the customer's name, which rides only in
 * the link's own visible text.
 *
 * The balance, "Registrar cobro" and the account are the payments domain's own
 * answer (payments.md, "On screen"): this test fakes `GET /customers/:id` and
 * `GET /customers/:id/account` and checks the screen only ever shows what those
 * answers carry, branching on `standing` and a row's `kind` — never a sign on a
 * number.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outlet, useLocation } from 'react-router'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import accountFixture from '../../api/fixtures/account.json'
import paymentFixture from '../../api/fixtures/payment.json'
import paymentPreviewFixture from '../../api/fixtures/payment-preview.json'
import type { Me } from '../../api/me'
import { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import { readNewSaleState } from '../../components/feedback'
import { SIN_CONEXION_TITULO } from '../../components/SinConexion'
import ClienteFicha from './ClienteFicha'

const ME: Me = { email: 'a@b.com', business_name: 'Negocio', today: '2026-10-03' }

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

function renderFicha(id: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/clientes/${id}`]}>
        <Routes>
          <Route element={<Context />}>
            <Route path="/clientes/:id" element={<ClienteFicha />} />
            <Route path="/clientes" element={<span>la lista</span>} />
            <Route path="/ventas/nueva" element={<NuevaVentaStub />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const SETTLED_CUSTOMER = {
  id: 3,
  name: 'Fer',
  phone: '+5491158423310',
  channel: 'telegram',
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

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('a customer that is gone shows the gone screen, with a way back to the list', async () => {
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse(404, { detail: 'no such customer', code: 'customer.not_found' }),
  )
  renderFicha('999')

  expect(await screen.findByText('Eso ya no está.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Volver a Clientes' })).toHaveAttribute(
    'href',
    '/clientes',
  )
  expect(screen.queryByText(/999/)).not.toBeInTheDocument()
})

test('a settled customer shows their phone, channel and VIP, no balance and no Registrar cobro', async () => {
  vi.mocked(fetch).mockImplementation(
    dispatchFetch({
      'GET /customers/3': () => jsonResponse(200, SETTLED_CUSTOMER),
      'GET /customers/3/account': () => jsonResponse(200, EMPTY_ACCOUNT),
    }),
  )
  renderFicha('3')

  expect(await screen.findByText('+54 9 11 5842-3310')).toBeInTheDocument()
  expect(screen.getByText('Telegram')).toBeInTheDocument()
  expect(screen.queryByText(/te debe/i)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Registrar cobro' })).not.toBeInTheDocument()
})

const NO_PHONE_CUSTOMER = {
  id: 4,
  name: 'Caro',
  phone: null,
  channel: null,
  vip: false,
  balance: 0,
  owing_since: null,
  standing: 'settled',
}

test('a customer with no phone shows no phone element, no dash, no empty label', async () => {
  vi.mocked(fetch).mockImplementation(
    dispatchFetch({
      'GET /customers/4': () => jsonResponse(200, NO_PHONE_CUSTOMER),
      'GET /customers/4/account': () => jsonResponse(200, EMPTY_ACCOUNT),
    }),
  )
  renderFicha('4')

  await screen.findByText('Caro')
  expect(screen.queryByText('Teléfono')).not.toBeInTheDocument()
  expect(screen.queryByText('-')).not.toBeInTheDocument()
  expect(screen.queryByText('Sin teléfono')).not.toBeInTheDocument()
})

test('"Nueva venta a <name>" opens the sale form with this customer chosen, by id alone', async () => {
  vi.mocked(fetch).mockImplementation(
    dispatchFetch({
      'GET /customers/3': () => jsonResponse(200, SETTLED_CUSTOMER),
      'GET /customers/3/account': () => jsonResponse(200, EMPTY_ACCOUNT),
    }),
  )
  renderFicha('3')

  const link = await screen.findByRole('link', { name: 'Nueva venta a Fer' })
  expect(link).toHaveAttribute('href', '/ventas/nueva')
  await userEvent.click(link)

  expect(await screen.findByText('Nueva venta para 3')).toBeInTheDocument()
})

const OWING_CUSTOMER = {
  id: 1,
  name: 'Ana',
  phone: '+5491122334455',
  channel: 'whatsapp',
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
  vi.mocked(fetch).mockImplementation(
    dispatchFetch({
      'GET /customers/1': () => jsonResponse(200, OWING_CUSTOMER),
      'GET /customers/1/account': () => jsonResponse(200, OWING_ACCOUNT),
    }),
  )
  renderFicha('1')

  expect(await screen.findByText('Te debe $ 11.000')).toBeInTheDocument()
  expect(screen.getByText('desde el 14/09')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Registrar cobro' })).toBeInTheDocument()
  expect(await screen.findByText('Quedó debiendo')).toBeInTheDocument()
})

const CREDIT_CUSTOMER = {
  id: 2,
  name: 'Lu',
  phone: '+5491100000000',
  channel: null,
  vip: false,
  balance: -2000,
  owing_since: null,
  standing: 'credit',
}

test('a customer in credit shows "A favor", never "Te debe", and no Registrar cobro', async () => {
  vi.mocked(fetch).mockImplementation(
    dispatchFetch({
      'GET /customers/2': () => jsonResponse(200, CREDIT_CUSTOMER),
      'GET /customers/2/account': () => jsonResponse(200, { ...EMPTY_ACCOUNT, balance: -2000, standing: 'credit' }),
    }),
  )
  renderFicha('2')

  expect(await screen.findByText('A favor $ 2.000')).toBeInTheDocument()
  expect(screen.queryByText(/te debe/i)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Registrar cobro' })).not.toBeInTheDocument()
})

test('the account labels a sale, a later payment\'s split and its leftover credit row only from kind/standing, never a sign on a number', async () => {
  // `account.json` (plan, invariants: "used by the front's fetch fakes") is the
  // one case on this branch with all three row kinds together: a sale left
  // owing, a later payment's split, and the credit left over once every debt is
  // settled. `CREDIT_CUSTOMER`'s own balance/standing match the fixture's
  // overall balance, so the card and the account agree.
  vi.mocked(fetch).mockImplementation(
    dispatchFetch({
      'GET /customers/2': () => jsonResponse(200, CREDIT_CUSTOMER),
      'GET /customers/2/account': () => jsonResponse(200, accountFixture),
    }),
  )
  renderFicha('2')

  await screen.findByText('Quedó debiendo')
  const account = document.querySelector('.cuenta-cliente')
  expect(account).not.toBeNull()
  const inAccount = within(account as HTMLElement)
  expect(inAccount.getByText('Cobro · efectivo · A cuenta de la venta del 14/09')).toBeInTheDocument()
  expect(inAccount.getByText('A favor')).toBeInTheDocument()

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
  expect(creditFila.querySelector('.cuenta-cliente__saldo')).toHaveTextContent('A favor $ 2.000')
})

test('Borrar cobro asks before deleting, then shows "Cobro eliminado" and refreshes the account', async () => {
  let deleted = false
  vi.mocked(fetch).mockImplementation(
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

  const borrar = await screen.findByRole('button', { name: 'Borrar cobro' })
  await userEvent.click(borrar)

  expect(
    screen.getByText('¿Borrás el cobro de $ 5.000 (efectivo) del 20/09?'),
  ).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Sí, borralo' }))

  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith('/payments/5', expect.objectContaining({ method: 'DELETE' })),
  )
  expect(await screen.findByText('Cobro eliminado')).toBeInTheDocument()
})

test('registering a payment shows "Cobro guardado · queda debiendo $ X" when something remains', async () => {
  vi.mocked(fetch).mockImplementation(
    dispatchFetch({
      'GET /customers/1': () => jsonResponse(200, OWING_CUSTOMER),
      'GET /customers/1/account': () => jsonResponse(200, OWING_ACCOUNT),
      'POST /customers/1/payments': () => jsonResponse(201, paymentFixture),
    }),
  )
  renderFicha('1')

  await userEvent.click(await screen.findByRole('button', { name: 'Registrar cobro' }))
  const sheet = (await screen.findByRole('button', { name: 'Guardar' })).closest('.capa__contenido')
  expect(sheet).not.toBeNull()
  await userEvent.clear(within(sheet as HTMLElement).getByLabelText('Monto'))
  await userEvent.type(within(sheet as HTMLElement).getByLabelText('Monto'), '5000')
  await userEvent.click(within(sheet as HTMLElement).getByLabelText('Efectivo'))
  await userEvent.click(within(sheet as HTMLElement).getByRole('button', { name: 'Guardar' }))

  // `payment.json`'s own `after.balance` (plan, invariants: "used by the front's
  // fetch fakes").
  expect(await screen.findByText('Cobro guardado · queda debiendo $ 6.000')).toBeInTheDocument()
})

test('"Todo" fills the amount with the balance, and the debounced preview shows the splits and what is left', async () => {
  vi.mocked(fetch).mockImplementation(
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

  await userEvent.click(await screen.findByRole('button', { name: 'Registrar cobro' }))
  const sheet = (await screen.findByRole('button', { name: 'Guardar' })).closest('.capa__contenido')
  expect(sheet).not.toBeNull()
  const within_ = within(sheet as HTMLElement)

  await userEvent.click(within_.getByRole('button', { name: 'Todo: $ 11.000' }))
  expect(within_.getByLabelText('Monto')).toHaveValue('11000')

  expect(await within_.findByText('Se descuenta de la deuda más vieja')).toBeInTheDocument()
  expect(await within_.findByText('$ 11.000 a la venta del 14/09')).toBeInTheDocument()
  expect(within_.queryByText(/Le queda debiendo/)).not.toBeInTheDocument()
})

test('a partial amount\'s preview shows "Le queda debiendo $ X", from the preview\'s own after.balance', async () => {
  vi.mocked(fetch).mockImplementation(
    dispatchFetch({
      'GET /customers/1': () => jsonResponse(200, OWING_CUSTOMER),
      'GET /customers/1/account': () => jsonResponse(200, OWING_ACCOUNT),
      // `payment-preview.json` (plan, invariants: "used by the front's fetch
      // fakes"): a 5000 split off the 14/09 sale, 6000 left owing.
      'POST /customers/1/payments/preview': () => jsonResponse(200, paymentPreviewFixture),
    }),
  )
  renderFicha('1')

  await userEvent.click(await screen.findByRole('button', { name: 'Registrar cobro' }))
  const sheet = (await screen.findByRole('button', { name: 'Guardar' })).closest('.capa__contenido')
  expect(sheet).not.toBeNull()
  const within_ = within(sheet as HTMLElement)

  await userEvent.clear(within_.getByLabelText('Monto'))
  await userEvent.type(within_.getByLabelText('Monto'), '5000')

  expect(await within_.findByText('$ 5.000 a la venta del 14/09')).toBeInTheDocument()
  expect(await within_.findByText('Le queda debiendo $ 6.000')).toBeInTheDocument()
})

test('registering a payment that settles everything shows the plain "Cobro guardado" toast', async () => {
  vi.mocked(fetch).mockImplementation(
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

  await userEvent.click(await screen.findByRole('button', { name: 'Registrar cobro' }))
  const sheet = (await screen.findByRole('button', { name: 'Guardar' })).closest('.capa__contenido')
  expect(sheet).not.toBeNull()
  await userEvent.click(within(sheet as HTMLElement).getByRole('button', { name: 'Todo: $ 11.000' }))
  await userEvent.click(within(sheet as HTMLElement).getByLabelText('Efectivo'))
  await userEvent.click(within(sheet as HTMLElement).getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByText('Cobro guardado')).toBeInTheDocument()
  expect(screen.queryByText(/queda debiendo/)).not.toBeInTheDocument()
})

test('a payment deleted by a partner meanwhile shows the gone notice, never the generic retry', async () => {
  vi.mocked(fetch).mockImplementation(
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

  const borrar = await screen.findByRole('button', { name: 'Borrar cobro' })
  await userEvent.click(borrar)
  await userEvent.click(screen.getByRole('button', { name: 'Sí, borralo' }))

  expect(await screen.findByText('Eso ya no está. La lista ya está al día.')).toBeInTheDocument()
  expect(screen.queryByText('Cobro eliminado')).not.toBeInTheDocument()
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

test('Borrar cobro when the connection drops shows "Sin conexión", never the generic retry or the gone notice', async () => {
  const base = dispatchFetch({
    'GET /customers/1': () => jsonResponse(200, OWING_CUSTOMER),
    'GET /customers/1/account': () => jsonResponse(200, ACCOUNT_WITH_ONE_PAYMENT),
  })
  // Same mechanism `client.test.ts` uses to turn a dropped connection into a
  // `NetworkError`: the fetch mock rejects, never resolves with a response.
  vi.mocked(fetch).mockImplementation((input, init) => {
    const method = init?.method ?? 'GET'
    if (method === 'DELETE') return Promise.reject(new TypeError('Failed to fetch'))
    return base(input, init)
  })
  renderFicha('1')

  const borrar = await screen.findByRole('button', { name: 'Borrar cobro' })
  await userEvent.click(borrar)
  await userEvent.click(screen.getByRole('button', { name: 'Sí, borralo' }))

  expect(await screen.findByText(SIN_CONEXION_TITULO)).toBeInTheDocument()
  expect(screen.queryByText(ERROR_GENERICO_MENSAJE)).not.toBeInTheDocument()
  expect(screen.queryByText('Eso ya no está. La lista ya está al día.')).not.toBeInTheDocument()
  expect(screen.queryByText('Cobro eliminado')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Borrar cobro' })).toBeInTheDocument()
})

test('Borrar cobro refused for a reason other than "gone" shows the generic retry, never "Sin conexión" or the gone notice', async () => {
  vi.mocked(fetch).mockImplementation(
    dispatchFetch({
      'GET /customers/1': () => jsonResponse(200, OWING_CUSTOMER),
      'GET /customers/1/account': () => jsonResponse(200, ACCOUNT_WITH_ONE_PAYMENT),
      'DELETE /payments/5': () =>
        jsonResponse(409, { detail: 'ya se cobró al momento', code: 'payment.on_the_spot' }),
    }),
  )
  renderFicha('1')

  const borrar = await screen.findByRole('button', { name: 'Borrar cobro' })
  await userEvent.click(borrar)
  await userEvent.click(screen.getByRole('button', { name: 'Sí, borralo' }))

  expect(await screen.findByText(ERROR_GENERICO_MENSAJE)).toBeInTheDocument()
  expect(screen.queryByText(SIN_CONEXION_TITULO)).not.toBeInTheDocument()
  expect(screen.queryByText('Eso ya no está. La lista ya está al día.')).not.toBeInTheDocument()
  expect(screen.queryByText('Cobro eliminado')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Borrar cobro' })).toBeInTheDocument()
})

test('a payment above the balance shows the fixed refusal inline and keeps what was typed', async () => {
  vi.mocked(fetch).mockImplementation(
    dispatchFetch({
      'GET /customers/1': () => jsonResponse(200, OWING_CUSTOMER),
      'GET /customers/1/account': () => jsonResponse(200, OWING_ACCOUNT),
      'POST /customers/1/payments': () => jsonResponse(422, { code: 'payment.above_balance' }),
    }),
  )
  renderFicha('1')

  await userEvent.click(await screen.findByRole('button', { name: 'Registrar cobro' }))
  const sheet = (await screen.findByRole('button', { name: 'Guardar' })).closest('.capa__contenido')
  expect(sheet).not.toBeNull()
  await userEvent.clear(within(sheet as HTMLElement).getByLabelText('Monto'))
  await userEvent.type(within(sheet as HTMLElement).getByLabelText('Monto'), '999000')
  await userEvent.click(within(sheet as HTMLElement).getByLabelText('Efectivo'))
  await userEvent.click(within(sheet as HTMLElement).getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByText('El monto supera lo que te debe.')).toBeInTheDocument()
  expect(within(sheet as HTMLElement).getByLabelText('Monto')).toHaveValue('999000')
})
