/**
 * `Ventas` at the screen seam (CODING_STANDARDS §10): Testing Library, `fetch`
 * faked. Periods come only from `format/dates.ts`'s helpers over `me.today`
 * (plan, invariants), never `new Date()`; the period's total and count are the
 * sum and the count of the sales the list itself renders.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import Ventas from './Ventas'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const ME: Me = { email: 'a@b.com', business_name: 'Negocio', today: '2026-10-03' }

function Context() {
  return <Outlet context={ME} />
}

function renderVentas() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/ventas']}>
        <Routes>
          <Route element={<Context />}>
            <Route path="/ventas" element={<Ventas />} />
            <Route path="/ventas/:id" element={<span>detalle</span>} />
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

test('Hoy, the default, asks the API for today alone', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, []))
  renderVentas()

  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/sales?date_from=2026-10-03&date_to=2026-10-03',
      expect.anything(),
    ),
  )
})

test('Semana asks for the Monday-to-Sunday week containing today', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, []))
  renderVentas()
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))

  await userEvent.click(screen.getByRole('button', { name: 'Semana' }))

  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/sales?date_from=2026-09-28&date_to=2026-10-04',
      expect.anything(),
    ),
  )
})

test('Mes asks for the current calendar month', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, []))
  renderVentas()
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))

  await userEvent.click(screen.getByRole('button', { name: 'Mes' }))

  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/sales?date_from=2026-10-01&date_to=2026-10-31',
      expect.anything(),
    ),
  )
})

test('Fechas opens on the current month and never lets the start run past the end', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, []))
  renderVentas()
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))

  await userEvent.click(screen.getByRole('button', { name: 'Fechas' }))

  const start = await screen.findByLabelText('Desde')
  const end = screen.getByLabelText('Hasta')
  expect(start).toHaveValue('2026-10-01')
  expect(end).toHaveValue('2026-10-31')
  expect(start).toHaveAttribute('max', '2026-10-31')
})

test("the period's total and count are the sum and the number of sales shown", async () => {
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse(200, [
      {
        id: 1,
        date: '2026-10-03',
        customer: { id: 5, name: 'Nico', vip: true },
        shipping_charged: 0,
        note: null,
        payment: 'cash',
        total: 6000,
        lines: [
          { variety_id: 1, variety_name: 'Blue Dream', grams: 5, pricing_rule: 'list', price_per_gram: 1200, line_total: 6000 },
        ],
      },
      {
        id: 2,
        date: '2026-10-02',
        customer: null,
        shipping_charged: 0,
        note: null,
        payment: 'none',
        total: 4000,
        lines: [
          { variety_id: 2, variety_name: 'OG Kush', grams: 2, pricing_rule: 'list', price_per_gram: 2000, line_total: 4000 },
        ],
      },
    ]),
  )
  renderVentas()

  expect(await screen.findByText('$ 10.000')).toBeInTheDocument()
  expect(screen.getByText('2 ventas')).toBeInTheDocument()
  expect(screen.getByText('Nico')).toBeInTheDocument()
  expect(screen.getByText('VIP')).toBeInTheDocument()
  expect(screen.getByText('Sin cliente')).toBeInTheDocument()
  expect(screen.getByText('Blue Dream 5 g')).toBeInTheDocument()
})

test('a sale with no customer shows "Sin cliente" and no VIP badge', async () => {
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse(200, [
      {
        id: 3,
        date: '2026-10-03',
        customer: null,
        shipping_charged: 0,
        note: null,
        payment: 'none',
        total: 1000,
        lines: [
          { variety_id: 1, variety_name: 'Blue Dream', grams: 1, pricing_rule: 'list', price_per_gram: 1000, line_total: 1000 },
        ],
      },
    ]),
  )
  renderVentas()

  expect(await screen.findByText('Sin cliente')).toBeInTheDocument()
  expect(screen.queryByText('VIP')).not.toBeInTheDocument()
})

test('an empty period shows the empty-list text, not a blank list', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, []))
  renderVentas()

  expect(await screen.findByText('Todavía no registraste ninguna venta en este período.')).toBeInTheDocument()
})

test('a dropped network shows Sin conexión, never the empty-list text', async () => {
  vi.mocked(fetch).mockRejectedValue(new TypeError('network error'))
  renderVentas()

  expect(await screen.findByText('Te quedaste sin internet')).toBeInTheDocument()
  expect(
    screen.queryByText('Todavía no registraste ninguna venta en este período.'),
  ).not.toBeInTheDocument()
})
