/**
 * `VentaDetalle` at the screen seam (CODING_STANDARDS §10): Testing Library,
 * `fetch` faked. Everything shown comes from the API's own answer (docs/adr/0009;
 * plan, invariants), never a preview; Deshacer only shows up right after a save,
 * through `feedback.ts`'s closed set, and clears itself from history state once
 * read (plan, invariants).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { readFeedback, saleJustSaved } from '../../components/feedback'
import VentaDetalle from './VentaDetalle'

/** Stands in for the real `Ventas` screen, just enough to show what `VentaDetalle`
 * navigated back with (plan, invariants: history state is only ever read through
 * `feedback.ts`), without pulling the whole list screen into this test. */
function VentasProbe() {
  const location = useLocation()
  const feedback = readFeedback(location.state)
  return (
    <span>
      lista de ventas
      {feedback !== null && <span>{feedback.message}</span>}
    </span>
  )
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const SALE = {
  id: 7,
  date: '2026-10-03',
  customer: { id: 5, name: 'Nico', vip: true },
  shipping_charged: 500,
  note: 'Entregar a la tarde',
  payment: 'cash',
  total: 6500,
  lines: [
    {
      variety_id: 1,
      variety_name: 'Blue Dream',
      grams: 5,
      pricing_rule: 'list',
      price_per_gram: 1200,
      line_total: 6000,
    },
  ],
}

function renderDetalle(initialState?: unknown) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{ pathname: '/ventas/7', state: initialState }]}>
        <Routes>
          <Route path="/ventas" element={<VentasProbe />} />
          <Route path="/ventas/:id" element={<VentaDetalle />} />
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

test('shows the total, each line with its rule badge, shipping, note, payment and customer, all from the API', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, SALE))
  renderDetalle()

  expect(await screen.findByText('$ 6.500')).toBeInTheDocument()
  expect(screen.getByText('Blue Dream')).toBeInTheDocument()
  expect(screen.getByText('Lista')).toBeInTheDocument()
  expect(screen.getByText('5 g')).toBeInTheDocument()
  expect(screen.getByText('$ 1.200/g')).toBeInTheDocument()
  expect(screen.getByText('$ 6.000')).toBeInTheDocument()
  expect(screen.getByText('$ 500')).toBeInTheDocument()
  expect(screen.getByText('Entregar a la tarde')).toBeInTheDocument()
  expect(screen.getByText('Efectivo')).toBeInTheDocument()
  expect(screen.getByText('Nico')).toBeInTheDocument()
  expect(screen.getByText('VIP')).toBeInTheDocument()
})

test('a sale with no customer shows "Sin cliente"', async () => {
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse(200, { ...SALE, customer: null, payment: 'none' }),
  )
  renderDetalle()

  expect(await screen.findByText('Sin cliente')).toBeInTheDocument()
  expect(screen.queryByText('Cómo se pagó')).not.toBeInTheDocument()
})

test('a gone sale shows the plain gone-detail state, never the generic retry', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(404, { code: 'sale.not_found' }))
  renderDetalle()

  expect(await screen.findByText('Eso ya no está.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Volver a Ventas' })).toHaveAttribute('href', '/ventas')
})

test('Borrar venta asks "Antes de borrar" naming the date and the amount, then deletes and returns to Ventas', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, SALE))
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))
  renderDetalle()
  await screen.findByText('$ 6.500')

  await userEvent.click(screen.getByRole('button', { name: 'Borrar venta' }))
  expect(
    screen.getByText('¿Borrás la venta de $ 6.500 del 03/10?'),
  ).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrala' }))

  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith('/sales/7', expect.objectContaining({ method: 'DELETE' })),
  )
  expect(await screen.findByText('lista de ventas')).toBeInTheDocument()
})

test('cancelling the delete confirmation keeps the sale', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, SALE))
  renderDetalle()
  await screen.findByText('$ 6.500')

  await userEvent.click(screen.getByRole('button', { name: 'Borrar venta' }))
  await userEvent.click(screen.getByRole('button', { name: 'No, dejala' }))

  expect(screen.queryByText('¿Borrás la venta de $ 6.500 del 03/10?')).not.toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('right after a save, "Venta guardada" shows with Deshacer, which deletes the sale named by the route\'s own id with no confirmation', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, SALE))
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))
  renderDetalle(saleJustSaved())
  await screen.findByText('$ 6.500')

  expect(screen.getByText('Venta guardada')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }))

  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith('/sales/7', expect.objectContaining({ method: 'DELETE' })),
  )
  expect(await screen.findByText('lista de ventas')).toBeInTheDocument()
})

test('opening the detail without the just-saved marker never shows Deshacer', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, SALE))
  renderDetalle()
  await screen.findByText('$ 6.500')

  expect(screen.queryByText('Venta guardada')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Deshacer' })).not.toBeInTheDocument()
})

test('a sale already gone when deleted shows the gone notice and returns to Ventas', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, SALE))
  vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(404, { code: 'sale.not_found' }))
  renderDetalle()
  await screen.findByText('$ 6.500')

  await userEvent.click(screen.getByRole('button', { name: 'Borrar venta' }))
  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrala' }))

  expect(await screen.findByText('Eso ya no está. La lista ya está al día.')).toBeInTheDocument()
})
