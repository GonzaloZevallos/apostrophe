/**
 * `Ventas` at the screen seam (CODING_STANDARDS §10): Testing Library, `fetch`
 * faked. Periods come only from `format/dates.ts`'s helpers over `me.today`
 * (plan, invariants), never `new Date()`; the period's total and count are the
 * sum and the count of the sales the list itself renders.
 */

import { SALE, SALES } from '../../routes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import saleFixture from '../../api/fixtures/sale.json'
import type { Me } from '../../api/me'
import { SHOWN_EN } from '../../test/shownLanguage'
import Ventas from './Ventas'
import { stubFetchWithSettings } from '../stubFetchWithSettings'
import { SIN_CONEXION_MENSAJE } from '../../copy/common'
import { gone } from '../../components/feedback'
import { baselineText } from '../../i18n/testing'


function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const ME: Me = { email: 'a@b.com', business_name: 'Business', today: '2026-10-03', shown_language: SHOWN_EN }

function Context() {
  return <Outlet context={ME} />
}

function renderVentas(state?: unknown) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{ pathname: SALES, state }]}>
        <Routes>
          <Route element={<Context />}>
            <Route path={SALES} element={<Ventas />} />
            <Route path={SALE} element={<span>detalle</span>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

let api: ReturnType<typeof stubFetchWithSettings>

beforeEach(() => {
  api = stubFetchWithSettings()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('Hoy, the default, asks the API for today alone', async () => {
  api.mockResolvedValue(jsonResponse(200, []))
  renderVentas()

  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      '/sales?date_from=2026-10-03&date_to=2026-10-03',
      expect.anything(),
    ),
  )
})

test('Semana asks for the Monday-to-Sunday week containing today', async () => {
  api.mockResolvedValue(jsonResponse(200, []))
  renderVentas()
  await waitFor(() => expect(api).toHaveBeenCalledTimes(1))

  await userEvent.click(screen.getByRole('button', { name: 'Week' }))

  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      '/sales?date_from=2026-09-28&date_to=2026-10-04',
      expect.anything(),
    ),
  )
})

test('Mes asks for the current calendar month', async () => {
  api.mockResolvedValue(jsonResponse(200, []))
  renderVentas()
  await waitFor(() => expect(api).toHaveBeenCalledTimes(1))

  await userEvent.click(screen.getByRole('button', { name: 'Month' }))

  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      '/sales?date_from=2026-10-01&date_to=2026-10-31',
      expect.anything(),
    ),
  )
})

test('Fechas opens on the current month and never lets the start run past the end', async () => {
  api.mockResolvedValue(jsonResponse(200, []))
  renderVentas()
  await waitFor(() => expect(api).toHaveBeenCalledTimes(1))

  await userEvent.click(screen.getByRole('button', { name: 'Dates' }))

  const start = await screen.findByLabelText('From')
  const end = screen.getByLabelText('To')
  expect(start).toHaveValue('2026-10-01')
  expect(end).toHaveValue('2026-10-31')
  expect(start).toHaveAttribute('max', '2026-10-31')
  // Regression: "To" must never carry a `max` lower than its own default value
  // (the month's last day, which can fall after today) — that would start the
  // field invalid and leave no way back to the range the PRD says Fechas opens on.
  expect(end).not.toHaveAttribute('max')
})

test("the period's total and count are the sum and the number of sales shown", async () => {
  api.mockResolvedValue(
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
          { product_id: 1, product_name: 'Blue Dream', quantity: 5, pricing_rule: 'list', price_per_gram: 1200, line_total: 6000 },
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
          { product_id: 2, product_name: 'OG Kush', quantity: 2, pricing_rule: 'list', price_per_gram: 2000, line_total: 4000 },
        ],
      },
    ]),
  )
  renderVentas()

  expect(await screen.findByText('$ 10.000')).toBeInTheDocument()
  expect(screen.getByText('03/10 · 2 sales')).toBeInTheDocument()
  expect(screen.getByText('Nico')).toBeInTheDocument()
  expect(screen.getByText('VIP')).toBeInTheDocument()
  expect(screen.getByText('No customer')).toBeInTheDocument()
  expect(screen.getByText('Blue Dream · 5 g')).toBeInTheDocument()
})

test('the header shows the range next to the total, dd/mm, collapsed to one date for Hoy', async () => {
  api.mockImplementation(() => Promise.resolve(jsonResponse(200, [])))
  renderVentas()

  expect(await screen.findByText('03/10 · 0 sales')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Week' }))
  expect(await screen.findByText('28/09 – 04/10 · 0 sales')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Month' }))
  expect(await screen.findByText('01/10 – 31/10 · 0 sales')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Dates' }))
  // Fechas opens on the current month's own range too (`custom` starts as
  // `monthRange(me.today)`), so it reads exactly like Mes here.
  expect(await screen.findByText('01/10 – 31/10 · 0 sales')).toBeInTheDocument()
})

test('each row carries the chevron icon', async () => {
  api.mockResolvedValue(jsonResponse(200, [saleFixture]))
  renderVentas()

  const row = await screen.findByRole('link')
  expect(row.querySelector('svg')).not.toBeNull()
})

test('a sale with no customer shows "No customer" and no VIP badge', async () => {
  api.mockResolvedValue(
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
          { product_id: 1, product_name: 'Blue Dream', quantity: 1, pricing_rule: 'list', price_per_gram: 1000, line_total: 1000 },
        ],
      },
    ]),
  )
  renderVentas()

  expect(await screen.findByText('No customer')).toBeInTheDocument()
  expect(screen.queryByText('VIP')).not.toBeInTheDocument()
})

test('a sale still owing shows its total in amber with "owes you" under it, from the API', async () => {
  // `sale.json` (plan, invariants: "used by the front's fetch fakes"): `still_owing`
  // true, `total` 11000.
  api.mockResolvedValue(jsonResponse(200, [saleFixture]))
  renderVentas()

  const row = await screen.findByRole('link')
  expect(within(row).getByText('owes you')).toBeInTheDocument()
  expect(within(row).getByText('$ 11.000')).toHaveClass('monto-deuda')
})

test('a sale paid in full shows no "owes you" mark', async () => {
  api.mockResolvedValue(
    jsonResponse(200, [{ ...saleFixture, payment: 'cash', still_owing: false }]),
  )
  renderVentas()

  const row = await screen.findByRole('link')
  expect(within(row).queryByText('owes you')).not.toBeInTheDocument()
})

test('an empty period shows the empty-list text, not a blank list', async () => {
  api.mockResolvedValue(jsonResponse(200, []))
  renderVentas()

  expect(await screen.findByText(baselineText('sales.ts:EMPTY_LIST'))).toBeInTheDocument()
})

test('a dropped network shows Sin conexión, never the empty-list text', async () => {
  api.mockRejectedValue(new TypeError('network error'))
  renderVentas()

  expect(await screen.findByText(SIN_CONEXION_MENSAJE)).toBeInTheDocument()
  expect(
    screen.queryByText(baselineText('sales.ts:EMPTY_LIST')),
  ).not.toBeInTheDocument()
})

test('arriving back from Delete sale or Deshacer shows "Sale deleted · the grams go back to stock"', async () => {
  api.mockResolvedValue(jsonResponse(200, []))
  renderVentas({ toast: 'common:saleDeletedGramsBack' })

  expect(
    await screen.findByText('Sale deleted · the grams go back to stock'),
  ).toBeInTheDocument()
})

test('arriving back after deleting an already-gone sale shows the gone notice', async () => {
  api.mockResolvedValue(jsonResponse(200, []))
  renderVentas(gone())

  expect(await screen.findByText('That is gone. The list is up to date.')).toBeInTheDocument()
})
