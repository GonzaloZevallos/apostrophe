/**
 * `Clientes` at the screen seam (CODING_STANDARDS §10): Testing Library, `fetch`
 * faked. Search lives in the /clientes layout's context, never the URL
 * (plan, invariants); a stale answer is only ever shown marked pending, never as
 * the answer to the query currently typed (`customers.md`, "List and search").
 *
 * The "Owed to you" section and each row's amber/blue mark come from
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
import CobroRoute from './CobroRoute'
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
import { EMPTY_CUSTOMERS, NOBODY_OWES } from '../../copy/customers'
import { SIN_CONEXION_MENSAJE } from '../../copy/common'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const LU_SETTLED = { id: 2, name: 'Lu', phone: '+5491100000002', vip: false, balance: 0, owing_since: null, standing: 'settled' }
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

  await userEvent.type(screen.getByLabelText('Search customer'), 'nico')

  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith('/customers?q=nico', expect.anything()),
  )
})

test('searching by digits of the phone also never touches the URL', async () => {
  vi.mocked(fetch).mockImplementation(fetchStub(() => jsonResponse(200, [])))
  renderClientes()
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/customers', expect.anything()))

  await userEvent.type(screen.getByLabelText('Search customer'), '6033')

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
          { id: 2, name: 'Nico Parra', phone: '+5491131785094', vip: false },
        ])
      }
      return jsonResponse(200, [])
    }),
  )
  renderClientes()

  const input = screen.getByLabelText('Search customer')
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
          { id: 1, name: 'Mica Solano', phone: '+5491160337725', vip: false },
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

  await userEvent.type(screen.getByLabelText('Search customer'), 'x')

  await waitFor(() => expect(screen.getByText('Searching…')).toBeInTheDocument())
  const list = screen.getByText('Searching…').closest('.lista-clientes')
  expect(list).toHaveAttribute('aria-busy', 'true')
  resolveX?.(jsonResponse(200, []))
})

test('a dropped network on the list shows Sin conexión, never the empty-list text', async () => {
  vi.mocked(fetch).mockRejectedValue(new TypeError('network error'))
  renderClientes()

  expect(await screen.findByText(SIN_CONEXION_MENSAJE)).toBeInTheDocument()
  expect(screen.queryByText('You have not added any customers yet.')).not.toBeInTheDocument()
})

test('a server error on the list shows the generic retry, never the empty-list text', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response('boom', { status: 500 }))
  renderClientes()

  expect(await screen.findByText('Something went wrong. Try again.')).toBeInTheDocument()
  expect(screen.queryByText('You have not added any customers yet.')).not.toBeInTheDocument()
})

test('Te deben sits above everyone A–Z, and the header carries no debt figure', async () => {
  // `customer.json` and `debtors.json` (plan, invariants: "used by the front's
  // fetch fakes") drive this: the customer list carries the fixture's own owing
  // entry plus a settled one, and the section reads straight off `debtors.json`.
  vi.mocked(fetch).mockImplementation(
    fetchStub(
      () =>
        jsonResponse(200, [
          customerFixture,
          { id: 2, name: 'Lu', phone: '+5491100000002', vip: false, balance: 0, owing_since: null, standing: 'settled' },
        ]),
      () => jsonResponse(200, debtorsFixture),
    ),
  )
  renderClientes()

  expect(await screen.findByText('2 customers')).toBeInTheDocument()
  expect(screen.queryByText(/ owe you \$/)).not.toBeInTheDocument()
  const section = await screen.findByRole('region', { name: 'Owed to you' })
  const everyone = await screen.findByRole('region', { name: 'Everyone · A–Z' })
  expect(section.compareDocumentPosition(everyone) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(
    within(section).getByText(`$ ${debtorsFixture.total_owed.toLocaleString('es-AR')}`),
  ).toBeInTheDocument()
  expect(within(section).getAllByRole('link').map((link) => link.textContent)).toEqual([
    'Ana Pérez$ 15.000owes you since 14/09',
    'Collect',
  ])
  expect(within(everyone).getByText('Lu')).toBeInTheDocument()
})

test("Te deben shows the API's order and total as answered, never a client sort or sum", async () => {
  // Later owing-since first, and a total that is not the sum of the rows: nothing here may
  // resort or add (payments.md, "Who owes and the totals").
  vi.mocked(fetch).mockImplementation(
    fetchStub(
      () => jsonResponse(200, []),
      () =>
        jsonResponse(200, {
          total_owed: 99000,
          sales_owing_count: 1,
          debtors: [
            { customer: { id: 5, name: 'Zoe' }, balance: 1000, owing_since: '2026-10-01', standing: 'owes' },
            { customer: { id: 4, name: 'Abel' }, balance: 9000, owing_since: '2026-08-01', standing: 'owes' },
          ],
        }),
    ),
  )
  renderClientes()

  const section = await screen.findByRole('region', { name: 'Owed to you' })
  expect(within(section).getByText('$ 99.000')).toBeInTheDocument()
  expect(within(section).getByText('1 venta debiendo')).toBeInTheDocument()
  expect(
    within(section).getAllByRole('link', { name: /^Collect from / }).map((link) => link.getAttribute('aria-label')),
  ).toEqual(['Collect from Zoe', 'Collect from Abel'])
})

test('a customer in credit is only in A–Z, never in Te deben', async () => {
  vi.mocked(fetch).mockImplementation(
    fetchStub(
      () =>
        jsonResponse(200, [
          { id: 2, name: 'Lu', phone: '+5491100000002', vip: false, balance: -2000, owing_since: null, standing: 'credit' },
        ]),
      () => jsonResponse(200, debtorsFixture),
    ),
  )
  renderClientes()

  const everyone = screen.getByRole('region', { name: 'Everyone · A–Z' })
  expect(await within(everyone).findByText('Credit $ 2.000')).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Owed to you' })).queryByText(/Credit/)).not.toBeInTheDocument()
})

test('searching collapses both sections into one flat list that keeps Cobrar, and clearing brings them back', async () => {
  vi.mocked(fetch).mockImplementation(
    fetchStub(
      (query) =>
        jsonResponse(
          200,
          query === '' ? [customerFixture, LU_SETTLED] : [customerFixture],
        ),
      () => jsonResponse(200, debtorsFixture),
    ),
  )
  renderClientes()
  await screen.findByRole('region', { name: 'Owed to you' })

  const input = screen.getByLabelText('Search customer')
  await userEvent.type(input, 'ana')

  await waitFor(() => expect(screen.queryByRole('region', { name: 'Owed to you' })).not.toBeInTheDocument())
  expect(screen.queryByRole('region', { name: 'Everyone · A–Z' })).not.toBeInTheDocument()
  expect(await screen.findAllByRole('link', { name: `Collect from ${customerFixture.name}` })).toHaveLength(1)
  expect(screen.getByText('owes you since 14/09')).toBeInTheDocument()

  await userEvent.clear(input)

  expect(await screen.findByRole('region', { name: 'Owed to you' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Everyone · A–Z' })).toBeInTheDocument()
})

test('"Collect from X" is on every row that owes, in the section and in the list, and never on one that does not', async () => {
  vi.mocked(fetch).mockImplementation(
    fetchStub(
      () =>
        jsonResponse(200, [
          customerFixture,
          { id: 2, name: 'Lu', phone: '+5491100000002', vip: false, balance: 0, owing_since: null, standing: 'settled' },
        ]),
      () => jsonResponse(200, debtorsFixture),
    ),
  )
  renderClientes()

  await screen.findByRole('region', { name: 'Owed to you' })
  const links = await screen.findAllByRole('link', { name: `Collect from ${customerFixture.name}` })
  expect(links).toHaveLength(2)
  for (const link of links) {
    expect(link).toHaveAttribute('href', pathTo(CUSTOMER_PAYMENT, { id: customerFixture.id }))
  }
  expect(screen.queryByRole('link', { name: 'Collect from Lu' })).not.toBeInTheDocument()
})

test('with nobody owing, a fixed "Nobody owes you" with nothing to tap sits above the full A–Z list', async () => {
  vi.mocked(fetch).mockImplementation(fetchStub(() => jsonResponse(200, [LU_SETTLED])))
  renderClientes()

  const nobody = await screen.findByText('Nobody owes you')
  expect(nobody.closest('a, button')).toBeNull()
  const section = screen.getByRole('region', { name: 'Owed to you' })
  expect(within(section).queryByRole('link')).not.toBeInTheDocument()
  expect(within(section).queryByText(/debiendo/)).not.toBeInTheDocument()
  const everyone = await screen.findByRole('region', { name: 'Everyone · A–Z' })
  expect(section.compareDocumentPosition(everyone) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(within(everyone).getByText('Lu')).toBeInTheDocument()
})

test('a customer with no phone shows no phone element, no dash, no empty label', async () => {
  vi.mocked(fetch).mockImplementation(fetchStub(() => jsonResponse(200, [customerNoPhoneFixture])))
  renderClientes()

  const row = await screen.findByRole('link', { name: new RegExp(customerNoPhoneFixture.name) })
  expect(row.querySelector('.lista-clientes__telefono')).toBeNull()
  expect(row).not.toHaveTextContent('-')
  expect(row).not.toHaveTextContent('Sin teléfono')
})

test('a customer who owes shows the amber mark; one in credit shows the blue "Credit"', async () => {
  vi.mocked(fetch).mockImplementation(
    fetchStub(() =>
      jsonResponse(200, [
        { id: 1, name: 'Ana', phone: '+5491100000001', vip: false, balance: 15000, owing_since: '2026-09-14', standing: 'owes' },
        { id: 2, name: 'Lu', phone: '+5491100000002', vip: false, balance: -2000, owing_since: null, standing: 'credit' },
      ]),
    ),
  )
  renderClientes()

  expect(await screen.findByText('owes you since 14/09')).toBeInTheDocument()
  expect(screen.getByText('Credit $ 2.000')).toBeInTheDocument()
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

const BEFORE = '/antes'

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
              { path: CUSTOMER_PAYMENT, element: <CobroRoute /> },
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

test('"Collect from X" opens Registrar cobro for that customer as an in-app entry, and one Back returns to Clientes', async () => {
  vi.mocked(fetch).mockImplementation(fetchApp)
  const router = renderApp()

  await userEvent.click((await screen.findAllByRole('link', { name: `Collect from ${customerFixture.name}` }))[0]!)

  expect(await screen.findByRole('button', { name: 'Save' })).toBeInTheDocument()
  expect(screen.getByText(new RegExp(`^${customerFixture.name}`))).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(ANA_PAYMENT)
  expect(router.state.location.state).toEqual(inAppState({ pathname: CUSTOMERS }))
  await act(() => router.navigate(-1))
  expect(router.state.location.pathname).toBe(CUSTOMERS)
})

test('Cerrar on Registrar cobro with nothing behind it goes to Clientes', async () => {
  vi.mocked(fetch).mockImplementation(fetchApp)
  const router = renderApp([ANA_PAYMENT])

  await userEvent.click(await screen.findByRole('button', { name: 'Close' }))

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

const LU = pathTo(CUSTOMER, { id: 2 })
const LU_CUSTOMER = { ...customerFixture, id: 2, name: 'Lu Gómez', phone: '+5491100000002' }

function fetchTwoCustomers(input: RequestInfo | URL): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString()
  if (url === '/payments/debtors') return Promise.resolve(jsonResponse(200, EMPTY_DEBTORS))
  if (url === `/customers/${LU_CUSTOMER.id}`) return Promise.resolve(jsonResponse(200, LU_CUSTOMER))
  if (url === `/customers/${LU_CUSTOMER.id}/account`) {
    return Promise.resolve(jsonResponse(200, { balance: 0, owing_since: null, standing: 'even', rows: [] }))
  }
  if (url === `/customers/${customerFixture.id}`) return Promise.resolve(jsonResponse(200, customerFixture))
  if (url === `/customers/${customerFixture.id}/account`) {
    return Promise.resolve(jsonResponse(200, { balance: 15000, owing_since: '2026-09-14', standing: 'owes', rows: [] }))
  }
  if (url.startsWith('/customers')) return Promise.resolve(jsonResponse(200, [customerFixture, LU_CUSTOMER]))
  return Promise.resolve(jsonResponse(404, {}))
}

/** The real layout route, as the router mounts it: on a computer it draws the list beside the card
 * (navigation.md's two panes) and the list stays mounted while the card changes, so a second
 * customer can be picked from it. */
function renderTwoPanes(entries: string[]) {
  const router = createMemoryRouter(
    [
      { path: BEFORE, element: <p>Pantalla anterior</p> },
      {
        element: <ClientesLayout />,
        children: [
          { path: CUSTOMERS, element: <Clientes /> },
          { path: CUSTOMER, element: <ClienteFicha /> },
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

test('on a computer, picking two customers replaces the entry each time, and one Back leaves Clientes', async () => {
  stubViewport('computer')
  vi.mocked(fetch).mockImplementation(fetchTwoCustomers)
  const router = renderTwoPanes([BEFORE, CUSTOMERS])

  const pick = async (name: RegExp, href: string) => {
    const rows = await screen.findAllByRole('link', { name })
    await userEvent.click(rows.find((link) => link.getAttribute('href') === href)!)
    await waitFor(() => expect(router.state.location.pathname).toBe(href))
    expect(router.state.historyAction).toBe('REPLACE')
  }
  await pick(/Ana Pérez/, ANA)
  await pick(/Lu Gómez/, LU)

  await act(() => router.navigate(-1))
  expect(router.state.location.pathname).toBe(BEFORE)
})

test('on a phone, picking a customer pushes, so Back returns to the list and not past it', async () => {
  stubViewport('phone')
  vi.mocked(fetch).mockImplementation(fetchTwoCustomers)
  const router = renderTwoPanes([BEFORE, CUSTOMERS])

  const rows = await screen.findAllByRole('link', { name: /Lu Gómez/ })
  await userEvent.click(rows.find((link) => link.getAttribute('href') === LU)!)
  await waitFor(() => expect(router.state.location.pathname).toBe(LU))
  expect(router.state.historyAction).toBe('PUSH')
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

  const links = await screen.findAllByRole('link', { name: `Collect from ${customerFixture.name}` })
  for (const link of links) {
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(link).toHaveTextContent('Collect')
  }
  const nuevo = screen.getByRole('link', { name: 'New customer' })
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

test('on a computer the list stays on the left beside a customer\'s card, and /customers alone selects nobody', async () => {
  stubViewport('computer')
  vi.mocked(fetch).mockImplementation(fetchTwoCustomers)

  const alone = renderTwoPanes([CUSTOMERS])
  await screen.findAllByRole('link', { name: /Ana Pérez/ })
  expect(screen.getAllByRole('region', { name: 'Everyone · A–Z' })).toHaveLength(1)
  expect(screen.queryByRole('button', { name: 'Record payment' })).not.toBeInTheDocument()
  expect(alone.state.location.pathname).toBe(CUSTOMERS)
})

test('on a computer, a customer\'s card has the list beside it, once', async () => {
  stubViewport('computer')
  vi.mocked(fetch).mockImplementation(fetchTwoCustomers)
  renderTwoPanes([ANA])

  expect(await screen.findByRole('region', { name: 'Everyone · A–Z' })).toBeInTheDocument()
  expect(await screen.findByText('Record payment')).toBeInTheDocument()
  expect(screen.getAllByRole('region', { name: 'Everyone · A–Z' })).toHaveLength(1)
})

test('on a phone, a customer\'s card is alone, with no list behind it', async () => {
  stubViewport('phone')
  vi.mocked(fetch).mockImplementation(fetchTwoCustomers)
  renderTwoPanes([ANA])

  expect(await screen.findByText('Record payment')).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Everyone · A–Z' })).not.toBeInTheDocument()
})
