/**
 * The customer screens and Ventas follow Clientes VIP (`pricing-settings.md`): while it is off
 * the VIP mark and the VIP field are hidden, with nothing in their place; while it is on they
 * show. Testing Library, `fetch` faked at the API.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import FlashProvider from '../../flash/FlashProvider'
import { CUSTOMER, CUSTOMERS, CUSTOMER_NEW, SALES, pathTo } from '../../routes'
import Ventas from '../ventas/Ventas'
import ClienteFicha from './ClienteFicha'
import Clientes from './Clientes'
import ClientesLayout from './ClientesLayout'
import ClienteForm from './ClienteForm'

const ME: Me = { email: 'a@b.com', business_name: 'Business', today: '2026-10-03' }

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function stub(vip: boolean, extra: Record<string, unknown>): void {
  const answers: Record<string, unknown> = {
    'GET /pricing-settings': { is_bulk_pricing: true, is_vip_customers: vip },
    ...extra,
  }
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string) =>
      Promise.resolve(
        `GET ${path}` in answers ? json(answers[`GET ${path}`]) : new Response('{}', { status: 404 }),
      ),
    ),
  )
}

function renderAt(path: string): void {
  const router = createMemoryRouter(
    [
      {
        element: (
          <FlashProvider>
            <Outlet context={ME} />
          </FlashProvider>
        ),
        children: [
          { path: SALES, element: <Ventas /> },
          { element: <ClientesLayout />, children: [{ path: CUSTOMERS, element: <Clientes /> }] },
          { path: CUSTOMER_NEW, element: <ClienteForm mode="nuevo" /> },
          { path: CUSTOMER, element: <ClienteFicha /> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

const FER = {
  id: 3,
  name: 'Fer',
  phone: '+5491158423310',
  vip: true,
  balance: 0,
  owing_since: null,
  standing: 'settled',
}
const SALE = {
  id: 1,
  date: '2026-10-03',
  customer: { id: 5, name: 'Nico', vip: true },
  shipping_charged: 0,
  note: null,
  payment: 'cash',
  total: 6000,
  lines: [
    { variety_id: 1, variety_name: 'Blue Dream', grams: 5, pricing_rule: 'vip', price_per_gram: 1200, line_total: 6000 },
  ],
}
const ACCOUNT = { balance: 0, owing_since: null, standing: 'settled', rows: [] }

afterEach(() => {
  vi.unstubAllGlobals()
})

test('Ventas shows a row\'s VIP badge only while Clientes VIP is on', async () => {
  stub(true, { 'GET /sales?date_from=2026-10-03&date_to=2026-10-03': [SALE] })
  renderAt(SALES)
  expect(await screen.findByText('VIP')).toBeInTheDocument()
})

test('Ventas hides a row\'s VIP badge while Clientes VIP is off', async () => {
  stub(false, { 'GET /sales?date_from=2026-10-03&date_to=2026-10-03': [SALE] })
  renderAt(SALES)
  expect(await screen.findByText('Nico')).toBeInTheDocument()
  expect(screen.queryByText('VIP')).not.toBeInTheDocument()
})

test('the customer card shows the VIP line only while Clientes VIP is on', async () => {
  stub(true, { 'GET /customers/3': FER, 'GET /customers/3/account': ACCOUNT })
  renderAt(pathTo(CUSTOMER, { id: 3 }))
  expect(await screen.findByText('VIP')).toBeInTheDocument()
})

test('the customer card hides the VIP line while Clientes VIP is off', async () => {
  stub(false, { 'GET /customers/3': FER, 'GET /customers/3/account': ACCOUNT })
  renderAt(pathTo(CUSTOMER, { id: 3 }))
  expect(await screen.findByText('Fer')).toBeInTheDocument()
  expect(screen.queryByText('VIP')).not.toBeInTheDocument()
})

test('the customer form shows the VIP field only while Clientes VIP is on', async () => {
  stub(true, {})
  renderAt(CUSTOMER_NEW)
  expect(await screen.findByText('VIP')).toBeInTheDocument()
})

test('the customer form has no VIP field while Clientes VIP is off', async () => {
  stub(false, {})
  renderAt(CUSTOMER_NEW)
  expect(await screen.findByText('Name')).toBeInTheDocument()
  expect(screen.queryByText('VIP')).not.toBeInTheDocument()
})

const LIST_FER = { ...FER, id: 3, name: 'Fer', owing_since: null }
const LIST_ANSWERS = { 'GET /customers': [LIST_FER], 'GET /payments/debtors': { total_owed: 0, sales_owing_count: 0, debtors: [] } }

test('the Clientes list shows a VIP customer\'s mark only while Clientes VIP is on', async () => {
  stub(true, LIST_ANSWERS)
  renderAt(CUSTOMERS)
  expect(await screen.findByText('Fer')).toBeInTheDocument()
  expect(screen.getByText('VIP')).toBeInTheDocument()
})

test('the Clientes list hides a VIP customer\'s mark while Clientes VIP is off', async () => {
  stub(false, LIST_ANSWERS)
  renderAt(CUSTOMERS)
  expect(await screen.findByText('Fer')).toBeInTheDocument()
  expect(screen.queryByText('VIP')).not.toBeInTheDocument()
})
