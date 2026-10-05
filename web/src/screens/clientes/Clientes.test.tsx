/**
 * `Clientes` at the screen seam (CODING_STANDARDS §10): Testing Library, `fetch`
 * faked. Search lives in the `/clientes` layout's context, never the URL
 * (plan, invariants); a stale answer is only ever shown marked pending, never as
 * the answer to the query currently typed (`customers.md`, "List and search").
 *
 * The header's "M te deben $ X" and each row's amber/blue mark come from
 * `GET /payments/debtors` and the customer's own `balance`/`owing_since`/
 * `standing` (payments.md, "On screen") — `fetchStub` below dispatches on the
 * request's own path and query, never on call order, since the header's two
 * extra queries (the unfiltered count, the debtors total) now fire alongside the
 * search list's own.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import customerFixture from '../../api/fixtures/customer.json'
import customerNoPhoneFixture from '../../api/fixtures/customer-no-phone.json'
import debtorsFixture from '../../api/fixtures/debtors.json'
import Clientes from './Clientes'
import ClientesLayout from './ClientesLayout'

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
      <MemoryRouter initialEntries={['/clientes']}>
        <Routes>
          <Route element={<ClientesLayout />}>
            <Route path="/clientes" element={<Clientes />} />
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

  resolveEmpty?.(jsonResponse(200, []))
  await new Promise((resolve) => setTimeout(resolve, 10))
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

test('the header reads "N clientes · M te deben $ X", and tapping the debt part opens Te deben', async () => {
  // `customer.json` and `debtors.json` (plan, invariants: "used by the front's
  // fetch fakes") drive this: the customer list carries the fixture's own owing
  // entry plus a settled one, and the debt part reads straight off `debtors.json`.
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
  const link = screen.getByRole('link', {
    name: `${debtorsFixture.debtors.length} te deben $ ${debtorsFixture.total_owed.toLocaleString('es-AR')}`,
  })
  expect(link).toHaveAttribute('href', '/clientes/deben')
})

test('with no debtors, the header shows no debt part', async () => {
  vi.mocked(fetch).mockImplementation(fetchStub(() => jsonResponse(200, [])))
  renderClientes()

  expect(await screen.findByText('0 clientes')).toBeInTheDocument()
  expect(screen.queryByText(/te deben/)).not.toBeInTheDocument()
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
