/**
 * `TeDeben`, the section on top of Clientes, at the screen seam (CODING_STANDARDS §10): Testing Library, `fetch`
 * faked. The list is the API's own order (plan, "Front": "the API's order"),
 * never resorted here; the total and count head the view and come from
 * `GET /payments/debtors` alone (payments.md, "Who owes and the totals").
 */

import { CUSTOMER, CUSTOMERS } from '../../routes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import debtorsFixture from '../../api/fixtures/debtors.json'
import TeDeben from './TeDeben'
import { SIN_CONEXION_MENSAJE } from '../../copy/common'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderTeDeben() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[CUSTOMERS]}>
        <Routes>
          <Route path={CUSTOMERS} element={<TeDeben />} />
          <Route path={CUSTOMER} element={<span>ficha</span>} />
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

test("heads with the total owed and lists debtors in the API's own order", async () => {
  // `debtors.json` (plan, invariants: "used by the front's fetch fakes") holds one
  // debtor; a second is added here only to prove the API's own order is kept,
  // never resorted by this screen.
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse(200, {
      ...debtorsFixture,
      debtors: [
        ...debtorsFixture.debtors,
        { customer: { id: 2, name: 'Beto' }, balance: 22000, owing_since: '2026-09-20', standing: 'owes' },
      ],
    }),
  )
  renderTeDeben()

  expect(await screen.findByText(`$ ${debtorsFixture.total_owed.toLocaleString('es-AR')}`)).toBeInTheDocument()

  const rows = screen
    .getAllByRole('link')
    .filter((link) => link.getAttribute('href')?.startsWith(`${CUSTOMERS}/`) && link.textContent !== 'Collect')
  expect(rows.map((row) => row.textContent)).toEqual([
    'Ana Pérez$ 15.000owes you since 14/09',
    'Beto$ 22.000owes you since 20/09',
  ])
  expect(screen.getAllByRole('link', { name: /^Collect from / }).map((link) => link.getAttribute('aria-label'))).toEqual([
    'Collect from Ana Pérez',
    'Collect from Beto',
  ])
})

test('one sale still owing reads "1 venta debiendo", singular', async () => {
  // `sales_owing_count` is overridden in memory, never read off the fixture
  // (plan invariant: "A test of a count line fakes the count it asserts and
  // compares against a literal string, never one derived from a fixture value").
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { ...debtorsFixture, sales_owing_count: 1 }))
  renderTeDeben()

  expect(await screen.findByText('1 venta debiendo')).toBeInTheDocument()
})

test('three sales still owing read "3 ventas debiendo", plural', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { ...debtorsFixture, sales_owing_count: 3 }))
  renderTeDeben()

  expect(await screen.findByText('3 ventas debiendo')).toBeInTheDocument()
})

test('nobody owing shows the fixed "Nobody owes you"', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { total_owed: 0, sales_owing_count: 0, debtors: [] }))
  renderTeDeben()

  expect(await screen.findByText('Nobody owes you')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Owed to you' })).toBeInTheDocument()
})

test('a dropped network shows nothing here: Clientes shows Sin conexión on its own list', async () => {
  vi.mocked(fetch).mockRejectedValue(new TypeError('network error'))
  renderTeDeben()

  await waitFor(() => expect(fetch).toHaveBeenCalled())
  expect(screen.queryByRole('region', { name: 'Owed to you' })).not.toBeInTheDocument()
  expect(screen.queryByText(SIN_CONEXION_MENSAJE)).not.toBeInTheDocument()
})
