/**
 * `VentaDetalle` at the screen seam (CODING_STANDARDS §10): Testing Library,
 * `fetch` faked. Everything shown comes from the API's own answer (docs/adr/0011;
 * plan, invariants), never a preview; Deshacer only shows up right after a save,
 * through `feedback.ts`'s closed set, and clears itself from history state once
 * read (plan, invariants).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
      cost: { costed: 2500, pending_grams: 0 },
    },
  ],
  still_owing: false,
  total_grams: 5,
}

/** `DELETE /sales/{id}`'s own answer (ADR-0009): the grams the sale gave back. */
const DELETED = { returned: [{ variety_id: 1, grams: 5 }] }

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

test('Borrar venta asks "Antes de borrar" naming the date, the amount and the grams returning to stock, then deletes and returns to Ventas', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, SALE))
  vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, DELETED))
  renderDetalle()
  await screen.findByText('$ 6.500')

  await userEvent.click(screen.getByRole('button', { name: 'Borrar venta' }))
  expect(
    screen.getByText('¿Borrás la venta de $ 6.500 del 03/10? Vuelven 5 g al stock.'),
  ).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrala' }))

  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith('/sales/7', expect.objectContaining({ method: 'DELETE' })),
  )
  expect(await screen.findByText('Venta eliminada')).toBeInTheDocument()
})

test('cancelling the delete confirmation keeps the sale', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, SALE))
  renderDetalle()
  await screen.findByText('$ 6.500')

  await userEvent.click(screen.getByRole('button', { name: 'Borrar venta' }))
  await userEvent.click(screen.getByRole('button', { name: 'No, dejala' }))

  expect(
    screen.queryByText('¿Borrás la venta de $ 6.500 del 03/10? Vuelven 5 g al stock.'),
  ).not.toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('right after a save, Deshacer deletes the sale with no confirmation and names the grams going back to stock', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, SALE))
  vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, DELETED))
  renderDetalle(saleJustSaved())
  await screen.findByText('$ 6.500')

  expect(screen.getByText('Venta guardada')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }))

  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith('/sales/7', expect.objectContaining({ method: 'DELETE' })),
  )
  expect(await screen.findByText('Venta eliminada · los gramos vuelven al stock')).toBeInTheDocument()
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

test('a sale with a customer already never shows Asignar cliente', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, SALE))
  renderDetalle()
  await screen.findByText('$ 6.500')

  expect(screen.queryByRole('button', { name: 'Asignar cliente' })).not.toBeInTheDocument()
})

const NICO_SEARCH_RESULT = { id: 5, name: 'Nico', phone: '1111', channel: 'whatsapp', vip: true }

/** Dispatches on method and path instead of call order: the sheet's own search
 * fires on every mount and keystroke, interleaved with whatever this screen's own
 * mutation fires, so a plain FIFO queue of `mockResolvedValueOnce` cannot tell
 * them apart reliably. */
function dispatchFetch(
  responses: Record<string, () => Response>,
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return (input, init) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = init?.method ?? 'GET'
    const key = `${method} ${url}`
    const makeResponse = responses[key]
    return Promise.resolve(makeResponse === undefined ? jsonResponse(200, []) : makeResponse())
  }
}

test('Asignar cliente opens the "Elegir cliente" sheet without "Sin cliente"; choosing a customer assigns it and shows the toast', async () => {
  let assigned = false
  vi.mocked(fetch).mockImplementation(
    dispatchFetch({
      'GET /sales/7': () =>
        jsonResponse(
          200,
          assigned ? { ...SALE, customer: { id: 5, name: 'Nico', vip: true } } : { ...SALE, customer: null, payment: 'none' },
        ),
      'GET /customers?q=Nico': () => jsonResponse(200, [NICO_SEARCH_RESULT]),
      'PUT /sales/7/customer': () => {
        assigned = true
        return jsonResponse(200, { ...SALE, customer: { id: 5, name: 'Nico', vip: true } })
      },
    }),
  )
  renderDetalle()
  await screen.findByText('Sin cliente')

  await userEvent.click(screen.getByRole('button', { name: 'Asignar cliente' }))
  expect(screen.getByText('Elegir cliente')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Sin cliente' })).not.toBeInTheDocument()

  fireEvent.change(screen.getByPlaceholderText('Teléfono o nombre'), { target: { value: 'Nico' } })
  await userEvent.click(await screen.findByText('Nico'))

  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/sales/7/customer',
      expect.objectContaining({ method: 'PUT' }),
    ),
  )
  expect(await screen.findByText('Cliente asignado')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Asignar cliente' })).not.toBeInTheDocument()
})

test('assigning a customer to a sale someone already assigned shows the fixed message and refreshes the detail', async () => {
  let assignedAlready = false
  vi.mocked(fetch).mockImplementation(
    dispatchFetch({
      'GET /sales/7': () =>
        jsonResponse(200, assignedAlready ? SALE : { ...SALE, customer: null, payment: 'none' }),
      'GET /customers?q=Nico': () => jsonResponse(200, [NICO_SEARCH_RESULT]),
      'PUT /sales/7/customer': () => {
        assignedAlready = true
        return jsonResponse(409, { code: 'sale.customer_already_assigned' })
      },
    }),
  )
  renderDetalle()
  await screen.findByText('Sin cliente')

  await userEvent.click(screen.getByRole('button', { name: 'Asignar cliente' }))
  fireEvent.change(screen.getByPlaceholderText('Teléfono o nombre'), { target: { value: 'Nico' } })
  await userEvent.click(await screen.findByText('Nico'))

  expect(await screen.findByText('Esta venta ya tiene cliente.')).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Asignar cliente' })).not.toBeInTheDocument())
})

test('assigning to a sale a partner deleted meanwhile shows the gone notice on Ventas', async () => {
  vi.mocked(fetch).mockImplementation(
    dispatchFetch({
      'GET /sales/7': () => jsonResponse(200, { ...SALE, customer: null, payment: 'none' }),
      'GET /customers?q=Nico': () => jsonResponse(200, [NICO_SEARCH_RESULT]),
      'PUT /sales/7/customer': () => jsonResponse(404, { code: 'sale.not_found' }),
    }),
  )
  renderDetalle()
  await screen.findByText('Sin cliente')

  await userEvent.click(screen.getByRole('button', { name: 'Asignar cliente' }))
  fireEvent.change(screen.getByPlaceholderText('Teléfono o nombre'), { target: { value: 'Nico' } })
  await userEvent.click(await screen.findByText('Nico'))

  expect(await screen.findByText('Eso ya no está. La lista ya está al día.')).toBeInTheDocument()
})

test('assigning a customer a partner deleted meanwhile shows the gone notice on Ventas', async () => {
  vi.mocked(fetch).mockImplementation(
    dispatchFetch({
      'GET /sales/7': () => jsonResponse(200, { ...SALE, customer: null, payment: 'none' }),
      'GET /customers?q=Nico': () => jsonResponse(200, [NICO_SEARCH_RESULT]),
      'PUT /sales/7/customer': () => jsonResponse(404, { code: 'sale.customer_not_found' }),
    }),
  )
  renderDetalle()
  await screen.findByText('Sin cliente')

  await userEvent.click(screen.getByRole('button', { name: 'Asignar cliente' }))
  fireEvent.change(screen.getByPlaceholderText('Teléfono o nombre'), { target: { value: 'Nico' } })
  await userEvent.click(await screen.findByText('Nico'))

  expect(await screen.findByText('Eso ya no está. La lista ya está al día.')).toBeInTheDocument()
})
