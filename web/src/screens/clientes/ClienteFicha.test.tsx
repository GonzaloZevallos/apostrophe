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
import type { Me } from '../../api/me'
import { readNewSaleState } from '../../components/feedback'
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
  // The sale row's own running balance ($ 11.000, still owing) and the payment
  // row's own running balance ($ 6.000, still owing) read as plain money; only
  // the credit row, picked by its own `standing`, drops the sign.
  expect(inAccount.getByText('$ 11.000')).toBeInTheDocument()
  expect(inAccount.getByText('$ 6.000')).toBeInTheDocument()
  expect(inAccount.getByText('A favor $ 2.000')).toBeInTheDocument()
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
      'POST /customers/1/payments': () =>
        jsonResponse(201, {
          payment: { id: 5, paid_on: '2026-10-03', amount: 5000, method: 'cash' },
          applied_to: [{ sale_id: 10, sale_date: '2026-09-14', amount: 5000 }],
          after: { balance: 6000, owing_since: '2026-09-14', standing: 'owes' },
        }),
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

  expect(await screen.findByText('Cobro guardado · queda debiendo $ 6.000')).toBeInTheDocument()
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
