/**
 * `Clientes` at the screen seam (CODING_STANDARDS §10): Testing Library, `fetch`
 * faked. Search lives in the /clientes layout's context, never the URL
 * (plan, invariants); a stale answer is only ever shown marked pending, never as
 * the answer to the query currently typed (`customers.md`, "List and search").
 *
 * The "Owed to you" section and each row's amber/blue mark come from
 * `GET /payments/debtors` and the customer's own `balance`/`owing_since`/
 * `standing` (payments.md, "En pantalla") — `fetchStub` below dispatches on the
 * request's own path and query, never on call order, since the header's two
 * extra queries (the unfiltered count, the debtors total) now fire alongside the
 * search list's own.
 */

import { CUSTOMER, CUSTOMER_NEW, CUSTOMER_PAYMENT, CUSTOMERS, pathTo } from '../../routes'
import { inAppState } from '../../components/inAppState'
import { consumePaymentReturn, peekPaymentReturn, setPaymentReturn } from '../../paymentReturn'
import { toast } from '../../components/feedback'
import { LIMITS, SAMPLES } from '../../copy/limits'
import { expectIconAndTextRule } from '../../test/iconAndTextRule'
import { stubViewport } from '../../test-viewport'
import { Outlet, createMemoryRouter, RouterProvider } from 'react-router'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import type { InitialEntry } from 'react-router'
import FlashProvider from '../../flash/FlashProvider'
import ClienteFicha from './ClienteFicha'
import { SAVED_TOAST } from './ClienteForm'
import { SheetRouterProvider } from '../../components/useSheetStack'
import CobroRoute from './CobroRoute'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { keys } from '../../api/keys'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import paymentPreviewFixture from '../../api/fixtures/payment-preview.json'
import customerFixture from '../../api/fixtures/customer.json'
import customerNoPhoneFixture from '../../api/fixtures/customer-no-phone.json'
import Clientes from './Clientes'
import ClientesLayout from './ClientesLayout'
import { baselineText } from '../../i18n/testing'

const EMPTY_CUSTOMERS = baselineText('customers.ts:EMPTY_CUSTOMERS')
const NOBODY_OWES = baselineText('customers.ts:NOBODY_OWES')
const SAVED_TOAST_TEXT = baselineText('common.ts:COMMON_TEXT.customerSaved')
import { SIN_CONEXION_MENSAJE } from '../../copy/common'
import { debtorsOf, NO_DEBTORS } from '../../test/debtors'

const DEBTORS_FIXTURE = debtorsOf()

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const LU_SETTLED = { id: 2, name: 'Lu', phone: '+5491100000002', phone_display: '+54 9 11 0000-0002', vip: false, balance: 0, owing_since: null, standing: 'settled' }
const EMPTY_DEBTORS = NO_DEBTORS

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
<MoneyFormatProvider format={{ symbol: '$', decimals: 0 }}>
      <MemoryRouter initialEntries={[CUSTOMERS]}>
        <Routes>
          <Route element={<Outlet context={{ email: 'a@b.com', business_name: 'N', today: '2026-10-03' }} />}>
            <Route element={<ClientesLayout />}>
              <Route path={CUSTOMERS} element={<Clientes />} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </MoneyFormatProvider>
</QueryClientProvider>,
  )
  return queryClient
}

/** The screen opens on 'Owed to you'; the full list is one tap away on 'All'. */
async function showAll() {
  await userEvent.click(await screen.findByRole('radio', { name: 'All' }))
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  // The hand-off a "Collect" click leaves lives in a module, not in the router: a test that
  // clicks it and never comes back would otherwise focus the next test's list.
  consumePaymentReturn()
})

test('the search is a search field with a search key and no autofill', async () => {
  vi.mocked(fetch).mockImplementation(fetchStub(() => jsonResponse(200, [])))
  renderClientes()
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/customers', expect.anything()))

  const search = screen.getByLabelText('Search customer')
  expect(search).toHaveAttribute('type', 'search')
  expect(search).toHaveAttribute('enterkeyhint', 'search')
  expect(search).toHaveAttribute('autocomplete', 'off')
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
          { id: 2, name: 'Nico Parra', phone: '+5491131785094', phone_display: '+54 9 11 3178-5094', vip: false },
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
          { id: 1, name: 'Mica Solano', phone: '+5491160337725', phone_display: '+54 9 11 6033-7725', vip: false },
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
  await showAll()
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
  expect(screen.queryByText(EMPTY_CUSTOMERS)).not.toBeInTheDocument()
})

test('a server error on the list shows the generic retry, never the empty-list text', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response('boom', { status: 500 }))
  renderClientes()

  expect(await screen.findByText('Something went wrong. Try again.')).toBeInTheDocument()
  expect(screen.queryByText(EMPTY_CUSTOMERS)).not.toBeInTheDocument()
})

test('both counts come from the API: All shows customer_count, Owed to you shows debtor_count', async () => {
  vi.mocked(fetch).mockImplementation(
    fetchStub(() => jsonResponse(200, []), () => jsonResponse(200, debtorsOf({ customer_count: 38, debtor_count: 6 }))),
  )
  renderClientes()

  const all = await screen.findByRole('radio', { name: 'All' })
  await waitFor(() => expect(all).toHaveTextContent(/^All\s*· 38$/))
  expect(screen.getByRole('radio', { name: 'Owed to you' })).toHaveTextContent(/^Owed to you\s*· 6$/)
})

test('the screen opens on Owed to you, and one tap on All switches the view', async () => {
  vi.mocked(fetch).mockImplementation(
    fetchStub(() => jsonResponse(200, [customerFixture, LU_SETTLED]), () => jsonResponse(200, DEBTORS_FIXTURE)),
  )
  renderClientes()

  expect(await screen.findByRole('radio', { name: 'Owed to you' })).toBeChecked()
  expect(screen.getByRole('radio', { name: 'All' })).not.toBeChecked()
  await showAll()
  expect(screen.getByRole('radio', { name: 'All' })).toBeChecked()
  expect(await screen.findByText('Lu')).toBeInTheDocument()
})

test('while debtors is pending the segments show no digit and no Nobody owes you', async () => {
  vi.mocked(fetch).mockImplementation(fetchStub(() => jsonResponse(200, [LU_SETTLED]), () => new Promise<Response>(() => {})))
  renderClientes()

  const group = await screen.findByRole('radiogroup', { name: 'Customers view' })
  expect(group).toHaveTextContent('AllOwed to you')
  expect(group.textContent).not.toMatch(/\d|·/)
  expect(screen.queryByText(NOBODY_OWES)).not.toBeInTheDocument()
  expect(screen.queryByText('Lu')).not.toBeInTheDocument()
})

test('a failed debtors read with the customers answering shows the flat list, with no segments', async () => {
  vi.mocked(fetch).mockImplementation(
    fetchStub(() => jsonResponse(200, [LU_SETTLED]), () => new Response('boom', { status: 500 })),
  )
  renderClientes()

  expect(await screen.findByText('Lu')).toBeInTheDocument()
  expect(screen.queryByRole('radiogroup', { name: 'Customers view' })).not.toBeInTheDocument()
  expect(screen.queryByText(NOBODY_OWES)).not.toBeInTheDocument()
})

test('figures shown and then a newer failed read drop to the flat list, with none of them', async () => {
  let failing = false
  vi.mocked(fetch).mockImplementation(
    fetchStub(
      () => jsonResponse(200, [LU_SETTLED]),
      () => (failing ? new Response('boom', { status: 500 }) : jsonResponse(200, DEBTORS_FIXTURE)),
    ),
  )
  const queryClient = renderClientes()
  await showAll()
  expect(await screen.findByText('Lu')).toBeInTheDocument()
  expect(screen.getByRole('radiogroup', { name: 'Customers view' })).toHaveTextContent(/\d/)

  failing = true
  await act(() => queryClient.invalidateQueries({ queryKey: keys.debtors() }))

  await waitFor(() => expect(screen.queryByRole('radiogroup', { name: 'Customers view' })).not.toBeInTheDocument())
  expect(screen.getByText('Lu')).toBeInTheDocument()
  expect(screen.queryByText(NOBODY_OWES)).not.toBeInTheDocument()
})

test('a failed debtors read that then answers lands on Owed to you, even after All was chosen', async () => {
  let failing = false
  vi.mocked(fetch).mockImplementation(
    fetchStub(
      () => jsonResponse(200, [customerFixture, LU_SETTLED]),
      () => (failing ? new Response('boom', { status: 500 }) : jsonResponse(200, DEBTORS_FIXTURE)),
    ),
  )
  const queryClient = renderClientes()
  await showAll()
  failing = true
  await act(() => queryClient.invalidateQueries({ queryKey: keys.debtors() }))
  await waitFor(() => expect(screen.queryByRole('radiogroup', { name: 'Customers view' })).not.toBeInTheDocument())

  failing = false
  await act(() => queryClient.invalidateQueries({ queryKey: keys.debtors() }))

  expect(await screen.findByRole('radio', { name: 'Owed to you' })).toBeChecked()
})

test('clearing a typed query returns to the segment chosen before typing', async () => {
  vi.mocked(fetch).mockImplementation(
    fetchStub(() => jsonResponse(200, [customerFixture, LU_SETTLED]), () => jsonResponse(200, DEBTORS_FIXTURE)),
  )
  renderClientes()
  await showAll()
  const input = screen.getByLabelText('Search customer')

  await userEvent.type(input, 'lu')
  await waitFor(() => expect(screen.queryByRole('radiogroup', { name: 'Customers view' })).not.toBeInTheDocument())
  await userEvent.clear(input)

  expect(await screen.findByRole('radio', { name: 'All' })).toBeChecked()
})

test('Owed to you opens first with the total and the debtor rows; All holds the rest, and the header carries no debt figure', async () => {
  // `customer.json` and `debtors.json` (plan, invariants: "used by the front's
  // fetch fakes") drive this: the customer list carries the fixture's own owing
  // entry plus a settled one, and the view reads straight off `debtors.json`.
  vi.mocked(fetch).mockImplementation(
    fetchStub(
      () =>
        jsonResponse(200, [
          customerFixture,
          { id: 2, name: 'Lu', phone: '+5491100000002', phone_display: '+54 9 11 0000-0002', vip: false, balance: 0, owing_since: null, standing: 'settled' },
        ]),
      () => jsonResponse(200, DEBTORS_FIXTURE),
    ),
  )
  renderClientes()

  const section = await screen.findByRole('region', { name: 'Owed to you' })
  expect(screen.queryByText(/^\d+ customers?$/)).not.toBeInTheDocument()
  expect(screen.queryByText(/ owe you \$/)).not.toBeInTheDocument()
  expect(screen.queryByText(/Everyone/)).not.toBeInTheDocument()
  expect(
    within(section).getByText(`$ ${DEBTORS_FIXTURE.total_owed.toLocaleString('es-AR')}`),
  ).toBeInTheDocument()
  expect(within(section).getAllByRole('link').map((link) => link.textContent)).toEqual([
    'APAna Pérez$ 15.000owes you since 14/09',
    'Collect',
  ])
  expect(screen.queryByText('Lu')).not.toBeInTheDocument()

  await showAll()
  expect(await screen.findByText('Lu')).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Owed to you' })).not.toBeInTheDocument()
})

test("Te deben shows the API's order and total as answered, never a client sort or sum", async () => {
  // Later owing-since first, and a total that is not the sum of the rows: nothing here may
  // resort or add (payments.md, "Quién debe y los totales").
  vi.mocked(fetch).mockImplementation(
    fetchStub(
      () => jsonResponse(200, []),
      () =>
        jsonResponse(
          200,
          debtorsOf({
            total_owed: 99000,
            sales_owing_count: 1,
            debtors: [
              { customer: { id: 5, name: 'Zoe' }, balance: 1000, owing_since: '2026-10-01', standing: 'owes', still_owing: null },
              { customer: { id: 4, name: 'Abel' }, balance: 9000, owing_since: '2026-08-01', standing: 'owes', still_owing: null },
            ],
          }),
        ),
    ),
  )
  renderClientes()

  const section = await screen.findByRole('region', { name: 'Owed to you' })
  expect(within(section).getByText('$ 99.000')).toBeInTheDocument()
  expect(within(section).queryByText(/sales? owing/)).not.toBeInTheDocument()
  expect(
    within(section).getAllByRole('link', { name: /^Collect from / }).map((link) => link.getAttribute('aria-label')),
  ).toEqual(['Collect from Zoe', 'Collect from Abel'])
})

test('a customer in credit is only in All, never in Owed to you', async () => {
  vi.mocked(fetch).mockImplementation(
    fetchStub(
      () =>
        jsonResponse(200, [
          { id: 2, name: 'Lu', phone: '+5491100000002', phone_display: '+54 9 11 0000-0002', vip: false, balance: -2000, owing_since: null, standing: 'credit' },
        ]),
      () => jsonResponse(200, DEBTORS_FIXTURE),
    ),
  )
  renderClientes()

  const section = await screen.findByRole('region', { name: 'Owed to you' })
  expect(within(section).queryByText(/Credit/)).not.toBeInTheDocument()
  await showAll()
  expect(await screen.findByText('Credit $ 2.000')).toBeInTheDocument()
})

test('searching collapses the segments into one flat list that keeps Collect, and clearing brings them back', async () => {
  vi.mocked(fetch).mockImplementation(
    fetchStub(
      (query) =>
        jsonResponse(
          200,
          query === '' ? [customerFixture, LU_SETTLED] : [customerFixture],
        ),
      () => jsonResponse(200, DEBTORS_FIXTURE),
    ),
  )
  renderClientes()
  await screen.findByRole('region', { name: 'Owed to you' })

  const input = screen.getByLabelText('Search customer')
  await userEvent.type(input, 'ana')

  await waitFor(() => expect(screen.queryByRole('region', { name: 'Owed to you' })).not.toBeInTheDocument())
  expect(screen.queryByRole('radiogroup', { name: 'Customers view' })).not.toBeInTheDocument()
  expect(await screen.findAllByRole('link', { name: `Collect from ${customerFixture.name}` })).toHaveLength(1)
  expect(screen.getByText('owes you since 14/09')).toBeInTheDocument()

  await userEvent.clear(input)

  expect(await screen.findByRole('region', { name: 'Owed to you' })).toBeInTheDocument()
  expect(screen.getByRole('radiogroup', { name: 'Customers view' })).toBeInTheDocument()
})

test('"Collect from X" is on every row that owes, in Owed to you and in All, and never on one that does not', async () => {
  vi.mocked(fetch).mockImplementation(
    fetchStub(
      () =>
        jsonResponse(200, [
          customerFixture,
          { id: 2, name: 'Lu', phone: '+5491100000002', phone_display: '+54 9 11 0000-0002', vip: false, balance: 0, owing_since: null, standing: 'settled' },
        ]),
      () => jsonResponse(200, DEBTORS_FIXTURE),
    ),
  )
  renderClientes()

  await screen.findByRole('region', { name: 'Owed to you' })
  const owed = await screen.findAllByRole('link', { name: `Collect from ${customerFixture.name}` })
  expect(owed).toHaveLength(1)
  expect(owed[0]).toHaveAttribute('href', pathTo(CUSTOMER_PAYMENT, { id: customerFixture.id }))

  await showAll()
  await screen.findByText('Lu')
  const all = screen.getAllByRole('link', { name: `Collect from ${customerFixture.name}` })
  expect(all).toHaveLength(1)
  expect(all[0]).toHaveAttribute('href', pathTo(CUSTOMER_PAYMENT, { id: customerFixture.id }))
  expect(screen.queryByRole('link', { name: 'Collect from Lu' })).not.toBeInTheDocument()
})

test('with nobody owing, only "Nobody owes you" shows with nothing to tap and no rows; All still lists everyone', async () => {
  vi.mocked(fetch).mockImplementation(fetchStub(() => jsonResponse(200, [LU_SETTLED])))
  renderClientes()

  const nobody = await screen.findByText(NOBODY_OWES)
  expect(nobody.closest('a, button')).toBeNull()
  const section = screen.getByRole('region', { name: 'Owed to you' })
  expect(within(section).queryByRole('link')).not.toBeInTheDocument()
  expect(screen.queryByText('Lu')).not.toBeInTheDocument()

  await showAll()
  expect(await screen.findByText('Lu')).toBeInTheDocument()
  expect(screen.queryByText(NOBODY_OWES)).not.toBeInTheDocument()
})

test('a row shows phone_display, never the stored phone, whatever country the number is from', async () => {
  const uy = { ...customerFixture, id: 9, name: 'Uri', balance: 0, owing_since: null, standing: 'settled', phone: '+59899123456', phone_display: '+598 99 123 456' }
  vi.mocked(fetch).mockImplementation(fetchStub(() => jsonResponse(200, [uy])))
  renderClientes()
  await showAll()

  const row = await screen.findByRole('link', { name: /Uri/ })
  expect(within(row).getByText('+598 99 123 456')).toBeInTheDocument()
  expect(screen.queryByText('+59899123456')).not.toBeInTheDocument()
})

test('a customer with no phone shows no phone element, no dash, no empty label', async () => {
  vi.mocked(fetch).mockImplementation(fetchStub(() => jsonResponse(200, [customerNoPhoneFixture])))
  renderClientes()
  await showAll()

  const row = await screen.findByRole('link', { name: new RegExp(customerNoPhoneFixture.name) })
  expect(row.querySelector('.lista-clientes__telefono')).toBeNull()
  expect(row).not.toHaveTextContent('-')
  expect(row).not.toHaveTextContent('Sin teléfono')
})

test('a customer who owes shows the amber mark; one in credit shows the blue "Credit"', async () => {
  vi.mocked(fetch).mockImplementation(
    fetchStub(() =>
      jsonResponse(200, [
        { id: 1, name: 'Ana', phone: '+5491100000001', phone_display: '+54 9 11 0000-0001', vip: false, balance: 15000, owing_since: '2026-09-14', standing: 'owes' },
        { id: 2, name: 'Lu', phone: '+5491100000002', phone_display: '+54 9 11 0000-0002', vip: false, balance: -2000, owing_since: null, standing: 'credit' },
      ]),
    ),
  )
  renderClientes()
  await showAll()

  expect(await screen.findByText('owes you since 14/09')).toBeInTheDocument()
  expect(screen.getByText('Credit $ 2.000')).toBeInTheDocument()
})

test('every row has a decorative initials avatar; only the rows that owe nothing end in a chevron', async () => {
  vi.mocked(fetch).mockImplementation(
    fetchStub(() =>
      jsonResponse(200, [
        { id: 1, name: 'Ana Pérez', phone: '+5491100000001', phone_display: '+54 9 11 0000-0001', vip: false, balance: 15000, owing_since: '2026-09-14', standing: 'owes' },
        { id: 2, name: 'Lu Fernández', phone: '+5491100000002', phone_display: '+54 9 11 0000-0002', vip: false, balance: -2000, owing_since: null, standing: 'credit' },
        { id: 3, name: 'Mica Solano', phone: '+5491100000003', phone_display: '+54 9 11 0000-0003', vip: false, balance: 0, owing_since: null, standing: 'settled' },
      ]),
    ),
  )
  renderClientes()
  await showAll()

  const ana = await screen.findByRole('link', { name: /^Ana Pérez/ })
  const lu = screen.getByRole('link', { name: /^Lu Fernández/ })
  const mica = screen.getByRole('link', { name: /^Mica Solano/ })
  const avatars = (row: HTMLElement) => Array.from(row.querySelectorAll('.avatar'))
  expect(avatars(ana).map((a) => a.textContent)).toEqual(['AP'])
  expect(avatars(lu).map((a) => a.textContent)).toEqual(['LF'])
  expect(avatars(mica).map((a) => a.textContent)).toEqual(['MS'])
  for (const row of [ana, lu, mica]) expect(avatars(row)[0]).toHaveAttribute('aria-hidden', 'true')
  expect(ana).not.toHaveAccessibleName(/^AP/)
  expect(ana.querySelector('svg')).toBeNull()
  expect(lu.lastElementChild?.tagName.toLowerCase()).toBe('svg')
  expect(mica.lastElementChild?.tagName.toLowerCase()).toBe('svg')
  expect(screen.getByRole('link', { name: 'Collect from Ana Pérez' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Collect from Lu Fernández' })).toBeNull()
})

// Opening a customer or a payment from the list (navigation.md, "In-app entries").
const ANA = pathTo(CUSTOMER, { id: customerFixture.id })
const ANA_PAYMENT = pathTo(CUSTOMER_PAYMENT, { id: customerFixture.id })

function fetchApp(input: RequestInfo | URL): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString()
  if (url === '/payments/debtors') return Promise.resolve(jsonResponse(200, DEBTORS_FIXTURE))
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
            <MoneyFormatProvider format={{ symbol: '$', decimals: 0 }}>
              <Outlet context={{ email: 'a@b.com', business_name: 'N', today: '2026-10-03', money: { symbol: '$', decimals: 0 } }} />
            </MoneyFormatProvider>
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
      <SheetRouterProvider router={router}>
        <RouterProvider router={router} />
      </SheetRouterProvider>
    </QueryClientProvider>,
  )
  return router
}

test('"Collect from X" opens Registrar cobro for that customer as an in-app entry, and one Back returns to Clientes', async () => {
  vi.mocked(fetch).mockImplementation(fetchApp)
  const router = renderApp()

  await userEvent.click((await screen.findAllByRole('link', { name: `Collect from ${customerFixture.name}` }))[0]!)

  expect(await screen.findByRole('button', { name: 'Save' })).toBeInTheDocument()
  // The form names the customer; the list behind it, inert, names them too.
  const named = screen.getAllByText(new RegExp(`^${customerFixture.name}`))
  expect(named.some((element) => element.closest('[inert]') === null)).toBe(true)
  expect(router.state.location.pathname).toBe(ANA_PAYMENT)
  expect(router.state.location.state).toEqual({ ...inAppState({ pathname: CUSTOMERS }), underneath: 'customers' })
  await act(() => router.navigate(-1))
  expect(router.state.location.pathname).toBe(CUSTOMERS)
})

test('opening "Collect from X" from the list leaves no hand-off, and Back through history keeps none', async () => {
  consumePaymentReturn()
  vi.mocked(fetch).mockImplementation(fetchApp)
  const router = renderApp()

  await userEvent.click((await screen.findAllByRole('link', { name: `Collect from ${customerFixture.name}` }))[0]!)
  expect(await screen.findByRole('button', { name: 'Save' })).toBeInTheDocument()
  expect(peekPaymentReturn()).toBeNull()

  await act(() => router.navigate(-1))
  expect(router.state.location.pathname).toBe(CUSTOMERS)
  expect(peekPaymentReturn()).toBeNull()
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
function renderTwoPanes(entries: InitialEntry[]) {
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
      <MoneyFormatProvider format={{ symbol: '$', decimals: 0 }}>
        <RouterProvider router={router} />
      </MoneyFormatProvider>
    </QueryClientProvider>,
  )
  return router
}

test('on a computer, picking two customers replaces the entry each time, and one Back leaves Clientes', async () => {
  stubViewport('computer')
  vi.mocked(fetch).mockImplementation(fetchTwoCustomers)
  const router = renderTwoPanes([BEFORE, CUSTOMERS])
  await showAll()

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
  await showAll()

  const rows = await screen.findAllByRole('link', { name: /Lu Gómez/ })
  await userEvent.click(rows.find((link) => link.getAttribute('href') === LU)!)
  await waitFor(() => expect(router.state.location.pathname).toBe(LU))
  expect(router.state.historyAction).toBe('PUSH')
  await act(() => router.navigate(-1))
  expect(router.state.location.pathname).toBe(CUSTOMERS)
})

// A customer's row is a record row: it keeps its layout and takes no icon (the rule's out of scope).
const RULE = { limits: LIMITS, samples: { name: SAMPLES.name }, optionClasses: ['lista-clientes__fila', 'inicio__avatar'] }

test('every action on the list and in Te deben is icon + text, and Cobrar keeps its accessible name', async () => {
  vi.mocked(fetch).mockImplementation(
    fetchStub(() => jsonResponse(200, [customerFixture]), () => jsonResponse(200, DEBTORS_FIXTURE)),
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

test('the header holds the title and "New customer" with its icon, and no count line', async () => {
  vi.mocked(fetch).mockImplementation(
    fetchStub(() => jsonResponse(200, [customerFixture]), () => jsonResponse(200, DEBTORS_FIXTURE)),
  )
  renderClientes()

  const nuevo = await screen.findByRole('link', { name: 'New customer' })
  const header = nuevo.closest('.clientes__encabezado')
  expect(header).not.toBeNull()
  expect(within(header as HTMLElement).getByText('Customers')).toBeInTheDocument()
  expect(nuevo).toHaveTextContent('New customer')
  expect(nuevo.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(screen.queryByText(/^\d+ customers?$/)).not.toBeInTheDocument()
})

test('tapping "New customer" opens the customer form', async () => {
  vi.mocked(fetch).mockImplementation(fetchStub(() => jsonResponse(200, [customerFixture])))
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MoneyFormatProvider format={{ symbol: '$', decimals: 0 }}>
        <MemoryRouter initialEntries={[CUSTOMERS]}>
          <Routes>
            <Route element={<ClientesLayout />}>
              <Route path={CUSTOMERS} element={<Clientes />} />
            </Route>
            <Route path={CUSTOMER_NEW} element={<span>customer form</span>} />
          </Routes>
        </MemoryRouter>
      </MoneyFormatProvider>
    </QueryClientProvider>,
  )

  await userEvent.click(await screen.findByRole('link', { name: 'New customer' }))

  expect(await screen.findByText('customer form')).toBeInTheDocument()
})

test('the two empty states are the registered strings, mounted and within their limit', async () => {
  vi.mocked(fetch).mockImplementation(fetchStub(() => jsonResponse(200, [])))
  renderClientes()

  const nobody = await screen.findByText(NOBODY_OWES)
  expect(nobody).toHaveAttribute('data-copy', 'emptyTitle')
  expectIconAndTextRule(document.body, RULE)
  await showAll()
  const empty = await screen.findByText(EMPTY_CUSTOMERS)
  expect(empty).toHaveAttribute('data-copy', 'emptyTitle')
  expectIconAndTextRule(document.body, RULE)
})

test('on a computer the list stays on the left beside a customer\'s card, and /customers alone selects nobody', async () => {
  stubViewport('computer')
  vi.mocked(fetch).mockImplementation(fetchTwoCustomers)

  const alone = renderTwoPanes([CUSTOMERS])
  await showAll()
  await screen.findAllByRole('link', { name: /Ana Pérez/ })
  expect(screen.getAllByRole('radiogroup', { name: 'Customers view' })).toHaveLength(1)
  expect(screen.queryByRole('button', { name: 'Record payment' })).not.toBeInTheDocument()
  expect(alone.state.location.pathname).toBe(CUSTOMERS)
})

test('on a computer, a customer\'s card has the list beside it, once', async () => {
  stubViewport('computer')
  vi.mocked(fetch).mockImplementation(fetchTwoCustomers)
  renderTwoPanes([ANA])

  expect(await screen.findByRole('radiogroup', { name: 'Customers view' })).toBeInTheDocument()
  expect(await screen.findByText('Record payment')).toBeInTheDocument()
  expect(screen.getAllByRole('radiogroup', { name: 'Customers view' })).toHaveLength(1)
})

test('on a computer, choosing All, opening a card and coming back keeps All selected', async () => {
  stubViewport('computer')
  vi.mocked(fetch).mockImplementation(fetchTwoCustomers)
  const router = renderTwoPanes([CUSTOMERS])
  await showAll()
  const rows = await screen.findAllByRole('link', { name: /Ana Pérez/ })
  await userEvent.click(rows.find((link) => link.getAttribute('href') === ANA)!)
  await waitFor(() => expect(router.state.location.pathname).toBe(ANA))
  await screen.findByText('Record payment')

  await act(() => router.navigate(CUSTOMERS))

  expect(await screen.findByRole('radio', { name: 'All' })).toBeChecked()
  expect(screen.getByRole('radio', { name: 'Owed to you' })).not.toBeChecked()
})

// GH-288: the card shows the toast `ClienteForm` hands over in history state. The list mounts
// beside it at that same entry, and read the same state: two "Customer saved" at once, so a
// locator for the text matched twice as soon as the card had loaded.
test('on a computer, the toast a new customer lands with shows once, in the card, never also in the list', async () => {
  stubViewport('computer')
  vi.mocked(fetch).mockImplementation(fetchTwoCustomers)
  renderTwoPanes([{ pathname: ANA, state: toast(SAVED_TOAST) }])

  await screen.findByText('Record payment')
  await screen.findByRole('radiogroup', { name: 'Customers view' })

  expect(screen.getAllByText(SAVED_TOAST_TEXT)).toHaveLength(1)
})

test('on a phone, a customer\'s card is alone, with no list behind it', async () => {
  stubViewport('phone')
  vi.mocked(fetch).mockImplementation(fetchTwoCustomers)
  renderTwoPanes([ANA])

  expect(await screen.findByText('Record payment')).toBeInTheDocument()
  expect(screen.queryByRole('radiogroup', { name: 'Customers view' })).not.toBeInTheDocument()
})

// After a save the list focuses its control (PM option a): the hand-off the save left is
// applied once the data has rendered, then taken.
test('after a save the list focuses that customer\'s "Collect" (the scroll is ScrollSync\'s)', async () => {
  vi.mocked(fetch).mockImplementation(fetchApp)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const router = renderApp()

  await userEvent.click((await screen.findAllByRole('link', { name: `Collect from ${customerFixture.name}` }))[0]!)
  await screen.findByRole('button', { name: 'Save' })
  setPaymentReturn(customerFixture.id)
  await act(() => router.navigate(-1))

  const collect = (await screen.findAllByRole('link', { name: `Collect from ${customerFixture.name}` }))[0]!
  await waitFor(() => expect(collect).toHaveFocus())
})

test('when the customer owes nothing any more the list focuses the "Owed to you" block instead', async () => {
  let paid = false
  vi.mocked(fetch).mockImplementation((input) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (paid && url === '/payments/debtors') return Promise.resolve(jsonResponse(200, EMPTY_DEBTORS))
    if (paid && url === '/customers') return Promise.resolve(jsonResponse(200, [{ ...customerFixture, balance: 0, owing_since: null, standing: 'settled' }]))
    return fetchApp(input)
  })
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const router = renderApp()

  await userEvent.click((await screen.findAllByRole('link', { name: `Collect from ${customerFixture.name}` }))[0]!)
  await screen.findByRole('button', { name: 'Save' })
  paid = true
  setPaymentReturn(customerFixture.id)
  await act(() => router.navigate(-1))

  const nobody = await screen.findByText(NOBODY_OWES)
  await waitFor(() => expect(nobody).toHaveFocus())
})

test('with no hand-off the list moves nothing and focuses nothing', async () => {
  vi.mocked(fetch).mockImplementation(fetchApp)
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  renderApp()

  const collect = (await screen.findAllByRole('link', { name: `Collect from ${customerFixture.name}` }))[0]!
  await new Promise((resolve) => setTimeout(resolve, 50))

  expect(collect).not.toHaveFocus()
  expect(scrollTo).not.toHaveBeenCalled()
})

// The debtors notice (`DebtorsSlot`): shown over the flat list when the owed figures did not load.
const DEBTORS_NOTICE = baselineText('customers.ts:CUSTOMERS_TEXT.debtorsUnavailable')

function requestsTo(path: string): number {
  return vi.mocked(fetch).mock.calls.filter(([input]) => (typeof input === 'string' ? input : String(input)) === path).length
}

/** A debtors read that fails until `answer` gives it a body. */
function flakyDebtors(): { fail: () => void; answer: (body: unknown) => void; respond: () => Response } {
  let body: unknown = null
  return {
    fail: () => {
      body = null
    },
    answer: (next) => {
      body = next
    },
    respond: () => (body === null ? new Response('boom', { status: 500 }) : jsonResponse(200, body)),
  }
}

test('a failing debtors read shows the notice over the flat list, and no segments, counts, card or Nobody owes you', async () => {
  vi.mocked(fetch).mockImplementation(
    fetchStub(() => jsonResponse(200, [customerFixture, LU_SETTLED]), () => new Response('boom', { status: 500 })),
  )
  renderClientes()

  const notice = await screen.findByRole('button', { name: DEBTORS_NOTICE })
  expect(screen.getAllByText(DEBTORS_NOTICE)).toHaveLength(1)
  expect(within(screen.getByRole('status')).getByRole('button', { name: DEBTORS_NOTICE })).toBe(notice)
  expect(await screen.findByText('Lu')).toBeInTheDocument()
  expect(screen.queryByRole('radiogroup', { name: 'Customers view' })).not.toBeInTheDocument()
  expect(screen.queryByText(NOBODY_OWES)).not.toBeInTheDocument()
  expect(screen.queryByText(/Total owed/)).not.toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/·|\$ ?0(?!\d)/)
})

test('tapping the notice re-reads only the debtors, and on success the segments and counts return on Owed to you', async () => {
  const debtors = flakyDebtors()
  vi.mocked(fetch).mockImplementation(fetchStub(() => jsonResponse(200, [customerFixture, LU_SETTLED]), debtors.respond))
  renderClientes()
  await userEvent.click(await screen.findByRole('button', { name: DEBTORS_NOTICE }))
  await waitFor(() => expect(requestsTo('/payments/debtors')).toBe(2))
  expect(requestsTo('/customers')).toBe(1)

  debtors.answer(DEBTORS_FIXTURE)
  await userEvent.click(await screen.findByRole('button', { name: DEBTORS_NOTICE }))

  const owed = await screen.findByRole('radio', { name: /Owed to you/ })
  expect(owed).toBeChecked()
  expect(owed).toHaveTextContent(/\d/)
  expect(requestsTo('/payments/debtors')).toBe(3)
  expect(requestsTo('/customers')).toBe(1)
  expect(screen.queryByRole('button', { name: DEBTORS_NOTICE })).not.toBeInTheDocument()
})

test('while a first-read retry is in flight the list stays, there is no skeleton, the notice is busy and a second tap sends nothing', async () => {
  let release: ((value: Response) => void) | undefined
  let calls = 0
  vi.mocked(fetch).mockImplementation(
    fetchStub(
      () => jsonResponse(200, [LU_SETTLED]),
      () => {
        calls += 1
        if (calls === 1) return new Response('boom', { status: 500 })
        return new Promise<Response>((resolve) => {
          release = resolve
        })
      },
    ),
  )
  renderClientes()
  const notice = await screen.findByRole('button', { name: DEBTORS_NOTICE })

  await userEvent.click(notice)
  await waitFor(() => expect(notice).toHaveAttribute('aria-busy', 'true'))
  expect(notice).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByText('Lu')).toBeInTheDocument()
  expect(document.querySelector('main')).not.toHaveAttribute('aria-busy', 'true')
  await userEvent.click(notice)

  expect(requestsTo('/payments/debtors')).toBe(2)
  release?.(jsonResponse(200, DEBTORS_FIXTURE))
  expect(await screen.findByRole('radio', { name: /Owed to you/ })).toBeChecked()
})

test('a retry that fails keeps the same button, replaces only its text and can be tapped again', async () => {
  vi.mocked(fetch).mockImplementation(fetchStub(() => jsonResponse(200, [LU_SETTLED]), () => new Response('boom', { status: 500 })))
  renderClientes()
  const notice = await screen.findByRole('button', { name: DEBTORS_NOTICE })
  const text = screen.getByText(DEBTORS_NOTICE)

  await userEvent.click(notice)
  await waitFor(() => expect(screen.getByText(DEBTORS_NOTICE)).not.toBe(text))

  expect(screen.getByRole('button', { name: DEBTORS_NOTICE })).toBe(notice)
  expect(notice).not.toHaveAttribute('aria-busy')
  expect(notice).not.toHaveAttribute('aria-disabled')
  await userEvent.click(notice)
  await waitFor(() => expect(requestsTo('/payments/debtors')).toBe(3))
})

test('from the keyboard: focus, Enter, a 500 and focus is still on the same notice', async () => {
  vi.mocked(fetch).mockImplementation(fetchStub(() => jsonResponse(200, [LU_SETTLED]), () => new Response('boom', { status: 500 })))
  renderClientes()
  const notice = await screen.findByRole('button', { name: DEBTORS_NOTICE })
  const text = screen.getByText(DEBTORS_NOTICE)

  notice.focus()
  await userEvent.keyboard('{Enter}')
  await waitFor(() => expect(screen.getByText(DEBTORS_NOTICE)).not.toBe(text))

  expect(document.activeElement).toBe(notice)
  expect(requestsTo('/payments/debtors')).toBe(2)
})

test('a typed query hides the notice, and a success arriving meanwhile leaves the chosen segment alone', async () => {
  const debtors = flakyDebtors()
  debtors.answer(DEBTORS_FIXTURE)
  vi.mocked(fetch).mockImplementation(fetchStub(() => jsonResponse(200, [customerFixture, LU_SETTLED]), debtors.respond))
  const queryClient = renderClientes()
  await showAll()
  debtors.fail()
  await act(() => queryClient.invalidateQueries({ queryKey: keys.debtors() }))
  await screen.findByRole('button', { name: DEBTORS_NOTICE })

  const input = screen.getByLabelText('Search customer')
  await userEvent.type(input, 'lu')
  await waitFor(() => expect(screen.queryByRole('button', { name: DEBTORS_NOTICE })).not.toBeInTheDocument())
  const before = requestsTo('/payments/debtors')
  debtors.answer(DEBTORS_FIXTURE)
  await act(() => queryClient.invalidateQueries({ queryKey: keys.debtors() }))
  await waitFor(() => expect(requestsTo('/payments/debtors')).toBeGreaterThan(before))
  await userEvent.clear(input)

  expect(await screen.findByRole('radio', { name: /All/ })).toBeChecked()
})

test('a failed refresh after figures were shown drops to the flat list with the notice', async () => {
  const debtors = flakyDebtors()
  debtors.answer(DEBTORS_FIXTURE)
  vi.mocked(fetch).mockImplementation(fetchStub(() => jsonResponse(200, [customerFixture, LU_SETTLED]), debtors.respond))
  const queryClient = renderClientes()
  expect(await screen.findByRole('radio', { name: /Owed to you/ })).toBeChecked()

  debtors.fail()
  await act(() => queryClient.invalidateQueries({ queryKey: keys.debtors() }))

  expect(await screen.findByRole('button', { name: DEBTORS_NOTICE })).toBeInTheDocument()
  expect(screen.queryByRole('radiogroup', { name: 'Customers view' })).not.toBeInTheDocument()
  expect(await screen.findByText('Lu')).toBeInTheDocument()
})

test('with both reads failing only the generic panel shows, and no node holds the notice sentence', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response('boom', { status: 500 }))
  renderClientes()

  expect(await screen.findByText('Something went wrong. Try again.')).toBeInTheDocument()
  expect(screen.queryByText(DEBTORS_NOTICE)).not.toBeInTheDocument()
})

test('with no customers the notice shows above the list\'s empty state, and Nobody owes you does not', async () => {
  vi.mocked(fetch).mockImplementation(fetchStub(() => jsonResponse(200, []), () => new Response('boom', { status: 500 })))
  renderClientes()

  const notice = await screen.findByRole('button', { name: DEBTORS_NOTICE })
  const empty = await screen.findByText(EMPTY_CUSTOMERS)
  expect(notice.compareDocumentPosition(empty) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.queryByText(NOBODY_OWES)).not.toBeInTheDocument()
})

test('the notice button is added only once the main area has stopped being busy', async () => {
  const busyWhenAdded: (string | null)[] = []
  const watch = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of Array.from(record.addedNodes)) {
        if (node instanceof HTMLButtonElement) busyWhenAdded.push(document.querySelector('main')?.getAttribute('aria-busy') ?? null)
      }
    }
  })
  vi.mocked(fetch).mockImplementation(fetchStub(() => jsonResponse(200, [LU_SETTLED]), () => new Response('boom', { status: 500 })))
  renderClientes()
  const main = document.querySelector('main')
  if (main === null) throw new Error('no main')
  watch.observe(main, { childList: true, subtree: true })

  await screen.findByRole('button', { name: DEBTORS_NOTICE })
  watch.disconnect()

  expect(busyWhenAdded.length).toBeGreaterThan(0)
  expect(busyWhenAdded.every((busy) => busy !== 'true')).toBe(true)
})

test('after a save and a failed debtors read focus lands on the notice when the customer row is gone', async () => {
  let paid = false
  vi.mocked(fetch).mockImplementation((input) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (paid && url === '/payments/debtors') return Promise.resolve(new Response('boom', { status: 500 }))
    if (paid && url === '/customers') return Promise.resolve(jsonResponse(200, [{ ...customerFixture, balance: 0, owing_since: null, standing: 'settled' }]))
    return fetchApp(input)
  })
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const router = renderApp()

  await userEvent.click((await screen.findAllByRole('link', { name: `Collect from ${customerFixture.name}` }))[0]!)
  await screen.findByRole('button', { name: 'Save' })
  paid = true
  setPaymentReturn(customerFixture.id)
  await act(() => router.navigate(-1))

  const notice = await screen.findByRole('button', { name: DEBTORS_NOTICE })
  await waitFor(() => expect(notice).toHaveFocus())
})

test('after a save and a failed debtors read focus lands on the customer\'s Collect in the flat list', async () => {
  let paid = false
  vi.mocked(fetch).mockImplementation((input) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (paid && url === '/payments/debtors') return Promise.resolve(new Response('boom', { status: 500 }))
    return fetchApp(input)
  })
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const router = renderApp()

  await userEvent.click((await screen.findAllByRole('link', { name: `Collect from ${customerFixture.name}` }))[0]!)
  await screen.findByRole('button', { name: 'Save' })
  paid = true
  setPaymentReturn(customerFixture.id)
  await act(() => router.navigate(-1))

  await screen.findByRole('button', { name: DEBTORS_NOTICE })
  const collect = (await screen.findAllByRole('link', { name: `Collect from ${customerFixture.name}` }))[0]!
  await waitFor(() => expect(collect).toHaveFocus())
})
