/**
 * `Ventas` at the screen seam (CODING_STANDARDS §10): Testing Library, `fetch`
 * faked. Periods come only from `format/dates.ts`'s helpers over `me.today`
 * (plan, invariants), never `new Date()`; the period's total and count are the
 * sum and the count of the sales the list itself renders.
 */

import { pathTo, SALE, SALES } from '../../routes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import { SHOWN_EN } from '../../test/shownLanguage'
import type { SaleLine } from '../../api/sales'
import Ventas from './Ventas'
import { saleWith } from './saleWith'
import { stubFetchWithSettings } from '../stubFetchWithSettings'
import { SIN_CONEXION_MENSAJE } from '../../copy/common'
import { gone } from '../../components/feedback'
import { baselineText } from '../../i18n/testing'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'


function line(name: string, quantity: number): SaleLine {
  return {
    product_id: 1,
    product_name: name,
    quantity,
    pricing_rule: 'list',
    customer_type_name: null,
    price_per_gram: 0,
    line_total: 0,
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const ME: Me = { email: 'a@b.com', business_name: 'Business', today: '2026-10-03', shown_language: SHOWN_EN, money: { symbol: '$', decimals: 0 } }

function Context() {
  return <MoneyFormatProvider format={ME.money}><Outlet context={ME} /></MoneyFormatProvider>
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
      saleWith('paid', { id: 1, total: 6000, customer: { id: 5, name: 'Nico', vip: true }, lines: [line('Blue Dream', 5)] }),
      saleWith('unpaid', { id: 2, total: 4000, customer: null, lines: [line('OG Kush', 2)] }),
    ]),
  )
  renderVentas()

  expect(await screen.findByText('$ 10.000')).toBeInTheDocument()
  expect(screen.getByText('03/10 · 2 sales')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Nico/ })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /No customer/ })).toBeInTheDocument()
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

test('one card per sale, each a link to its sale', async () => {
  api.mockResolvedValue(
    jsonResponse(200, [
      saleWith('paid', { id: 11, customer: { id: 1, name: 'Ana Pérez', vip: false } }),
      saleWith('unpaid', { id: 12, customer: { id: 2, name: 'Beto Díaz', vip: false } }),
    ]),
  )
  renderVentas()

  const ana = await screen.findByRole('link', { name: /Ana Pérez/ })
  expect(ana).toHaveAttribute('href', pathTo(SALE, { id: 11 }))
  expect(screen.getByRole('link', { name: /Beto Díaz/ })).toHaveAttribute('href', pathTo(SALE, { id: 12 }))
})

test('each card shows the chip of its own Payment state, from the API', async () => {
  api.mockResolvedValue(
    jsonResponse(200, [
      saleWith('paid', { id: 1, customer: { id: 1, name: 'Ana Pérez', vip: false } }),
      saleWith('unpaid', { id: 2, customer: { id: 2, name: 'Beto Díaz', vip: false } }),
      saleWith('part_paid', { id: 3, customer: { id: 3, name: 'Carla Ruiz', vip: false } }),
    ]),
  )
  renderVentas()

  const ana = await screen.findByRole('link', { name: /Ana Pérez/ })
  expect(within(ana).getByText('Paid')).toBeInTheDocument()
  expect(within(screen.getByRole('link', { name: /Beto Díaz/ })).getByText('Unpaid')).toBeInTheDocument()
  const carla = screen.getByRole('link', { name: /Carla Ruiz/ })
  expect(within(carla).getByText('$ 4.000').parentElement).toHaveTextContent('Part-paid · $ 4.000 owed')
})

test('a nine-digit part-paid amount is one element, never split from its symbol', async () => {
  api.mockResolvedValue(
    jsonResponse(200, [
      saleWith('part_paid', { id: 4, total: 1500000000, still_owed: 999999999, lines: [line('Blue Dream', 5)] }),
    ]),
  )
  renderVentas()

  const card = await screen.findByRole('link', { name: /Ana Pérez/ })
  const amount = within(card).getByText('$ 999.999.999')
  expect(amount).toHaveClass('cifra-n')
  expect(amount.parentElement).toHaveTextContent('Part-paid · $ 999.999.999 owed')
  expect(within(card).getByText('$ 1.500.000.000')).toHaveClass('sale-card__total')
})

test("a state that cannot be shown says so, and the card beside it is unaffected", async () => {
  api.mockResolvedValue(
    jsonResponse(200, [
      saleWith(null, { id: 1, customer: { id: 1, name: 'Ana Pérez', vip: false } }),
      saleWith('part_paid', { id: 2, still_owed: 0, customer: { id: 2, name: 'Beto Díaz', vip: false } }),
      saleWith('part_paid', { id: 3, still_owed: null, customer: { id: 3, name: 'Carla Ruiz', vip: false } }),
      saleWith('paid', { id: 4, customer: { id: 4, name: 'Dora Gil', vip: false } }),
    ]),
  )
  renderVentas()

  for (const name of [/Ana Pérez/, /Beto Díaz/, /Carla Ruiz/]) {
    const card = await screen.findByRole('link', { name })
    expect(within(card).getByText("Payment can't be shown")).toBeInTheDocument()
    expect(within(card).queryByText('Paid')).not.toBeInTheDocument()
  }
  const dora = screen.getByRole('link', { name: /Dora Gil/ })
  expect(within(dora).getByText('Paid')).toBeInTheDocument()
})

test('a sale with no customer shows "No customer"', async () => {
  api.mockResolvedValue(jsonResponse(200, [saleWith('paid', { id: 3, customer: null })]))
  renderVentas()

  expect(await screen.findByText('No customer')).toBeInTheDocument()
})

test('a sale with two lines shows the first and "+1 more"', async () => {
  api.mockResolvedValue(
    jsonResponse(200, [saleWith('paid', { lines: [line('Blue Dream', 5), line('Rosa', 1.5)] })]),
  )
  renderVentas()

  const card = await screen.findByRole('link', { name: /Ana Pérez/ })
  expect(within(card).getByText('Blue Dream × 5')).toBeInTheDocument()
  expect(within(card).getByText('+1 more')).toBeInTheDocument()
})

test('the list shows no "owes you" mark, VIP badge or grams, even for a VIP customer still owing', async () => {
  api.mockResolvedValue(
    jsonResponse(200, [
      saleWith('unpaid', { customer: { id: 1, name: 'Ana Pérez', vip: true }, lines: [line('Blue Dream', 5)] }),
    ]),
  )
  renderVentas()

  await screen.findByRole('link', { name: /Ana Pérez/ })
  expect(screen.queryByText('owes you')).not.toBeInTheDocument()
  expect(screen.queryByText('VIP')).not.toBeInTheDocument()
  expect(screen.queryByText(/\d g\b/)).not.toBeInTheDocument()
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
