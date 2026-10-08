/**
 * `Clientes` at the screen seam (CODING_STANDARDS §10): Testing Library, `fetch`
 * faked. Search lives in the /clientes layout's context, never the URL
 * (plan, invariants); a stale answer is only ever shown marked pending, never as
 * the answer to the query currently typed (`customers.md`, "List and search").
 *
 * The "Te deben" section and each row's amber/blue mark come from
 * `GET /payments/debtors` and the customer's own `balance`/`owing_since`/
 * `standing` (payments.md, "On screen") — `fetchStub` below dispatches on the
 * request's own path and query, never on call order, since the header's two
 * extra queries (the unfiltered count, the debtors total) now fire alongside the
 * search list's own.
 */

import { CUSTOMER, CUSTOMER_PAYMENT, CUSTOMERS, pathTo } from '../../routes'
import { inAppState } from '../../components/inAppState'
import { LIMITS, SAMPLES } from '../../copy/limits'
import { expectIconAndTextRule } from '../../test/iconAndTextRule'
import { stubViewport } from '../../test-viewport'
import { Outlet, createMemoryRouter, RouterProvider } from 'react-router'
import FlashProvider from '../../flash/FlashProvider'
import ClienteFicha from './ClienteFicha'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import paymentPreviewFixture from '../../api/fixtures/payment-preview.json'
import customerFixture from '../../api/fixtures/customer.json'
import customerNoPhoneFixture from '../../api/fixtures/customer-no-phone.json'
import debtorsFixture from '../../api/fixtures/debtors.json'
import Clientes from './Clientes'
import ClientesLayout from './ClientesLayout'
import { EMPTY_CUSTOMERS, NOBODY_OWES } from './messages'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const EMPTY_DEBTORS = { total_owed: 0, sales_owing_count: 0, debtors: [] }

/** Dispatches on the request's own path, not on call order (plan, invariants):
 * `/payments/debtors` goes to `debtors`, `/customers` and `/customers?q=...` go
 * to `customers` with the query string (`''` for no `q`) picked apart. */
function fetchStub(
  customers: (query: string) => Response | Promise<Response>,
  debtors: () => Response | Promise<Response> = () => jsonResponse(200, EMPTY_DEBTORS),
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return (input) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url === '/payments/debtors') return Promise.resolve(debtors())
    const match = /^\/customers(?:\?q=(.*))?$/.exec(url)
    const query = match?.[1] !== undefined ? decodeURIComponent(match[1]) : ''
    return Promise.resolve(customers(query))
  }
}

function renderClientes() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[CUSTOMERS]}>
        <Routes>
          <Route element={<ClientesLayout />}>
            <Route path={CUSTOMERS} element={<Clientes />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('searching by part of the name calls the API with that query, never the URL', async () => {
  vi.mocked(fetch).mockImplementation(fetchStub(() => jsonResponse(200, [])))
  renderClientes()

  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/customers', expect.anything()))

  await userEvent.type(screen.getByLabelText('Buscar cliente'), 'nico')

  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith('/customers?q=nico', expect.anything()),
  )
})

test('searching by digits of the phone also never touches the URL', async () => {
  vi.mocked(fetch).mockImplementation(fetchStub(() => jsonResponse(200, [])))
  renderClientes()
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/customers', expect.anything()))

  await userEvent.type(screen.getByLabelText('Buscar cliente'), '6033')

  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith('/customers?q=6033', expect.anything()),
  )
})

test('a stale answer still in flight shows marked pending, never as the current result', async () => {
  let resolveEmpty: ((value: Response) => void) | undefined
  vi.mocked(fetch).mockImplementation(
    fetchStub((query) => {
      if (query === '') {
        return new Promise<Response>((resolve) => {
          resolveEmpty = resolve
        })
      }
      if (query === 'ni') {
        return jsonResponse(200, [
          { id: 2, name: 'Nico Parra', phone: '+5491131785094', channel: null, vip: false },
        ])
      }
      return jsonResponse(200, [])
    }),
  )
  renderClientes()

  const input = screen.getByLabelText('Buscar cliente')
  await userEvent.type(input, 'ni')

  // The newer query ("ni") already answered while the first (empty query) is
  // still pending: the list must show the newer data, and never let the first
  // call's late answer replace it afterwards.
  await waitFor(() => expect(screen.getByText('Nico Parra')).toBeInTheDocument())

  // Let the late answer be read to its end, then check it replaced nothing. The body is a
  // stream that only runs when something reads it, however (`json()`, `text()`): the wait
  // is on that read, not on a guessed number of milliseconds.
  let lateBodyRead = false
  const lateBody = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        lateBodyRead = true
        controller.enqueue(new TextEncoder().encode('[]'))
        controller.close()
      },
    },
    { highWaterMark: 0 },
  )
  resolveEmpty?.(
    new Response(lateBody, { status: 200, headers: { 'Content-Type': 'application/json' } }),
  )
  await waitFor(() => expect(lateBodyRead).toBe(true))
  await act(async () => {})
  expect(screen.getByText('Nico Parra')).toBeInTheDocument()
})

test('a result still catching up to a newer keystroke is marked pending, not current', async () => {
  let resolveX: ((value: Response) => void) | undefined
  vi.mocked(fetch).mockImplementation(
    fetchStub((query) => {
      if (query === '') {
        return jsonResponse(200, [
          { id: 1, name: 'Mica Solano', phone: '+5491160337725', channel: null, vip: false },
        ])
      }
      if (query === 'x') {
        return new Promise<Response>((resolve) => {
          resolveX = resolve
        })
      }
      return jsonResponse(200, [])
    }),
  )
  renderClientes()
  await waitFor(() => expect(screen.getByText('Mica Solano')).toBeInTheDocument())

  await userEvent.type(screen.getByLabelText('Buscar cliente'), 'x')

  await waitFor(() => expect(screen.getByText('Buscando…')).toBeInTheDocument())
  const list = screen.getByText('Buscando…').closest('.lista-clientes')
  expect(list).toHaveAttribute('aria-busy', 'true')
  resolveX?.(jsonResponse(200, []))
})

test('a dropped network on the list shows Sin conexión, never the empty-list text', async () => {
  vi.mocked(fetch).mockRejectedValue(new TypeError('network error'))
  renderClientes()

  expect(await screen.findByText('Te quedaste sin internet')).toBeInTheDocument()
  expect(screen.queryByText('Todavía no agregaste ningún cliente.')).not.toBeInTheDocument()
})

test('a server error on the list shows the generic retry, never the empty-list text', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response('boom', { status: 500 }))
  renderClientes()

  expect(await screen.findByText('Algo falló. Probá de nuevo.')).toBeInTheDocument()
  expect(screen.queryByText('Todavía no agregaste ningún cliente.')).not.toBeInTheDocument()
})

test('the header reads "N clientes", and the Te deben section sits above the list with the debtors', async () => {
  // `customer.json` and `debtors.json` (plan, invariants: "used by the front's
  // fetch fakes") drive this: the customer list carries the fixture's own owing
  // entry plus a settled one, and the section reads straight off `debtors.json`. The old
  // Te deben screen is gone (`/clientes/deben` redirects here), so this is where it lives.
  vi.mocked(fetch).mockImplementation(
    fetchStub(
      () =>
        jsonResponse(200, [
          customerFixture,
          { id: 2, name: 'Lu', phone: '+5491100000002', channel: null, vip: false, balance: 0, owing_since: null, standing: 'settled' },
        ]),
      () => jsonResponse(200, debtorsFixture),
    ),
  )
  renderClientes()

  expect(await screen.findByText('2 clientes')).toBeInTheDocument()
  expect(
    await screen.findByText(
      `· ${debtorsFixture.debtors.length} te deben $ ${debtorsFixture.total_owed.toLocaleString('es-AR')}`,
    ),
  ).toBeInTheDocument()
  const section = await screen.findByRole('region', { name: 'Te deben' })
  expect(
    within(section).getByText(`$ ${debtorsFixture.total_owed.toLocaleString('es-AR')}`),
  ).toBeInTheDocument()
  expect(within(section).getAllByRole('link').map((link) => link.textContent)).toEqual([
    'Ana Pérez$ 15.000desde 14/09',
    'Cobrar',
  ])
})

test('"Cobrar a X" is on every row that owes, in the section and in the list, and never on one that does not', async () => {
  vi.mocked(fetch).mockImplementation(
    fetchStub(
      () =>
        jsonResponse(200, [
          customerFixture,
          { id: 2, name: 'Lu', phone: '+5491100000002', channel: null, vip: false, balance: 0, owing_since: null, standing: 'settled' },
        ]),
      () => jsonResponse(200, debtorsFixture),
    ),
  )
  renderClientes()

  await screen.findByRole('region', { name: 'Te deben' })
  const links = await screen.findAllByRole('link', { name: `Cobrar a ${customerFixture.name}` })
  expect(links).toHaveLength(2)
  for (const link of links) {
    expect(link).toHaveAttribute('href', pathTo(CUSTOMER_PAYMENT, { id: customerFixture.id }))
  }
  expect(screen.queryByRole('link', { name: 'Cobrar a Lu' })).not.toBeInTheDocument()
})

test('with no debtors, the header shows no debt part and the section says "Nadie te debe."', async () => {
  vi.mocked(fetch).mockImplementation(fetchStub(() => jsonResponse(200, [])))
  renderClientes()

  expect(await screen.findByText('0 clientes')).toBeInTheDocument()
  expect(await screen.findByText('Nadie te debe.')).toBeInTheDocument()
  expect(screen.queryByText(/ te deben \$/)).not.toBeInTheDocument()
})

test('a customer with no phone shows no phone element, no dash, no empty label', async () => {
  vi.mocked(fetch).mockImplementation(fetchStub(() => jsonResponse(200, [customerNoPhoneFixture])))
  renderClientes()

  const row = await screen.findByRole('link', { name: new RegExp(customerNoPhoneFixture.name) })
  expect(row.querySelector('.lista-clientes__telefono')).toBeNull()
  expect(row).not.toHaveTextContent('-')
  expect(row).not.toHaveTextContent('Sin teléfono')
})

test('a customer who owes shows the amber mark; one in credit shows the blue "A favor"', async () => {
  vi.mocked(fetch).mockImplementation(
    fetchStub(() =>
      jsonResponse(200, [
        { id: 1, name: 'Ana', phone: '+5491100000001', channel: null, vip: false, balance: 15000, owing_since: '2026-09-14', standing: 'owes' },
        { id: 2, name: 'Lu', phone: '+5491100000002', channel: null, vip: false, balance: -2000, owing_since: null, standing: 'credit' },
      ]),
    ),
  )
  renderClientes()

  expect(await screen.findByText('te debe desde 14/09')).toBeInTheDocument()
  expect(screen.getByText('A favor $ 2.000')).toBeInTheDocument()
})

// Opening a customer or a payment from the list (navigation.md, "In-app entries").
const ANA = pathTo(CUSTOMER, { id: customerFixture.id })
const ANA_PAYMENT = pathTo(CUSTOMER_PAYMENT, { id: customerFixture.id })

function fetchApp(input: RequestInfo | URL): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString()
  if (url === '/payments/debtors') return Promise.resolve(jsonResponse(200, debtorsFixture))
  if (url.includes('/preview')) return Promise.resolve(jsonResponse(200, paymentPreviewFixture))
  if (url === `/customers/${customerFixture.id}`) return Promise.resolve(jsonResponse(200, customerFixture))
  if (url === `/customers/${customerFixture.id}/account`) {
    return Promise.resolve(
      jsonResponse(200, { balance: 15000, owing_since: '2026-09-14', standing: 'owes', rows: [] }),
    )
  }
  if (url.startsWith('/customers')) return Promise.resolve(jsonResponse(200, [customerFixture]))
  return Promise.resolve(jsonResponse(404, {}))
}

async function openCustomerRow() {
  const links = await screen.findAllByRole('link', { name: /Ana Pérez/ })
  await userEvent.click(links.find((link) => link.getAttribute('href') === ANA)!)
}

function renderApp(entries: string[] = [CUSTOMERS]) {
  const router = createMemoryRouter(
    [
      {
        element: (
          <FlashProvider>
            <Outlet context={{ email: 'a@b.com', business_name: 'N', today: '2026-10-03' }} />
          </FlashProvider>
        ),
        children: [
          {
            element: <ClientesLayout />,
            children: [
              { path: CUSTOMERS, element: <Clientes /> },
              { path: CUSTOMER, element: <ClienteFicha /> },
              { path: CUSTOMER_PAYMENT, element: <ClienteFicha payment /> },
            ],
          },
        ],
      },
    ],
    { initialEntries: entries },
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

test('"Cobrar a X" opens Registrar cobro for that customer as an in-app entry, and one Back returns to Clientes', async () => {
  vi.mocked(fetch).mockImplementation(fetchApp)
  const router = renderApp()

  await userEvent.click((await screen.findAllByRole('link', { name: `Cobrar a ${customerFixture.name}` }))[0]!)

  expect(await screen.findByRole('button', { name: 'Guardar' })).toBeInTheDocument()
  expect(screen.getByText(customerFixture.name)).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(ANA_PAYMENT)
  expect(router.state.location.state).toEqual(inAppState({ pathname: CUSTOMERS }))
  await act(() => router.navigate(-1))
  expect(router.state.location.pathname).toBe(CUSTOMERS)
})

test('Cerrar on Registrar cobro with nothing behind it goes to Clientes', async () => {
  vi.mocked(fetch).mockImplementation(fetchApp)
  const router = renderApp([ANA_PAYMENT])

  await userEvent.click(await screen.findByRole('button', { name: 'Cerrar' }))

  await waitFor(() => expect(router.state.location.pathname).toBe(CUSTOMERS))
})

test('on a computer, Clientes selects nobody by itself', async () => {
  stubViewport('computer')
  vi.mocked(fetch).mockImplementation(fetchApp)
  const router = renderApp()

  await screen.findAllByRole('link', { name: /Ana Pérez/ })
  expect(router.state.location.pathname).toBe(CUSTOMERS)
  expect(router.state.historyAction).toBe('POP')
})

test('on a phone, opening a customer pushes an entry, and Back returns to the list', async () => {
  stubViewport('phone')
  vi.mocked(fetch).mockImplementation(fetchApp)
  const router = renderApp()

  await openCustomerRow()

  await waitFor(() => expect(router.state.location.pathname).toBe(ANA))
  expect(router.state.historyAction).toBe('PUSH')
  expect(router.state.location.state).toEqual(inAppState({ pathname: CUSTOMERS }))
  await act(() => router.navigate(-1))
  expect(router.state.location.pathname).toBe(CUSTOMERS)
})

// A customer's row is a record row: it keeps its layout and takes no icon (the rule's out of scope).
const RULE = { limits: LIMITS, samples: { name: SAMPLES.name }, optionClasses: ['lista-clientes__fila'] }

test('every action on the list and in Te deben is icon + text, and Cobrar keeps its accessible name', async () => {
  vi.mocked(fetch).mockImplementation(
    fetchStub(() => jsonResponse(200, [customerFixture]), () => jsonResponse(200, debtorsFixture)),
  )
  renderClientes()

  const links = await screen.findAllByRole('link', { name: `Cobrar a ${customerFixture.name}` })
  for (const link of links) {
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(link).toHaveTextContent('Cobrar')
  }
  const nuevo = screen.getByRole('link', { name: 'Nuevo cliente' })
  expect(nuevo.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expectIconAndTextRule(document.body, RULE)
})

test('the two empty states are the registered strings, mounted and within their limit', async () => {
  vi.mocked(fetch).mockImplementation(fetchStub(() => jsonResponse(200, [])))
  renderClientes()

  const empty = await screen.findByText(EMPTY_CUSTOMERS)
  expect(empty).toHaveAttribute('data-copy', 'emptyTitle')
  const nobody = await screen.findByText(NOBODY_OWES)
  expect(nobody).toHaveAttribute('data-copy', 'emptyTitle')
  expectIconAndTextRule(document.body, RULE)
})
