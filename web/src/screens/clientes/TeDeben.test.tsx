/**
 * `TeDeben` at the screen seam (CODING_STANDARDS §10): Testing Library, `fetch`
 * faked. The list is the API's own order (plan, "Front": "the API's order"),
 * never resorted here; the total and count head the view and come from
 * `GET /payments/debtors` alone (payments.md, "Who owes and the totals").
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import debtorsFixture from '../../api/fixtures/debtors.json'
import TeDeben from './TeDeben'

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
      <MemoryRouter initialEntries={['/clientes/deben']}>
        <Routes>
          <Route path="/clientes/deben" element={<TeDeben />} />
          <Route path="/clientes/:id" element={<span>ficha</span>} />
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

test('heads with the total owed and the count of sales still owing, lists debtors in the API\'s own order', async () => {
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
  expect(screen.getByText(`${debtorsFixture.sales_owing_count} ventas debiendo`)).toBeInTheDocument()

  const rows = screen.getAllByRole('link').filter((link) => link.getAttribute('href')?.startsWith('/clientes/'))
  expect(rows.map((row) => row.textContent)).toEqual([
    'Ana Pérez$ 15.000desde 14/09',
    'Beto$ 22.000desde 20/09',
  ])
})

test('an empty debtors list shows the empty-state text', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { total_owed: 0, sales_owing_count: 0, debtors: [] }))
  renderTeDeben()

  expect(await screen.findByText('Nadie te debe.')).toBeInTheDocument()
})

test('a dropped network shows Sin conexión', async () => {
  vi.mocked(fetch).mockRejectedValue(new TypeError('network error'))
  renderTeDeben()

  expect(await screen.findByText('Te quedaste sin internet')).toBeInTheDocument()
})
