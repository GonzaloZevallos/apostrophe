/**
 * `VentaDetalle` at the screen seam (CODING_STANDARDS §10): Testing Library,
 * `fetch` faked. Everything shown comes from the API's own answer (docs/adr/0011;
 * plan, invariants), never a preview; Deshacer only shows up right after a save,
 * through `feedback.ts`'s closed set, and clears itself from history state once
 * read (plan, invariants).
 *
 * The sale `GET /sales/{id}` answers with is `fixtures/sale-detail.json` itself
 * (plan, "Fixtures": the front's `fetch` fakes import the same files the backend
 * checks its real answers against), with per-test overrides only where a test's
 * own point needs a field the fixture's one example does not carry (a note, a
 * VIP customer, no customer at all).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import SALE from '../../api/fixtures/sale-detail.json'
import { readFeedback, saleJustSaved } from '../../components/feedback'
import VentaDetalle from './VentaDetalle'
import { paths } from '../../routes/paths'

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

/** `DELETE /sales/{id}`'s own answer (ADR-0009): the grams the sale gave back. */
const DELETED = { returned: [{ variety_id: 2, grams: 3.5 }] }

function renderDetalle(initialState?: unknown) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{ pathname: paths.sale(10), state: initialState }]}>
        <Routes>
          <Route path={paths.sales()} element={<VentasProbe />} />
          <Route path={paths.sale(':id')} element={<VentaDetalle />} />
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

test('shows the total, each line with its lowercase rule badge, shipping, note and the final Total row, all from the API', async () => {
  // The fixture's one example owes and carries no note: this test's own point is
  // that every one of these fields renders, so it overrides just those two,
  // keeping everything else — id, lines, total_grams — as the real answer's shape.
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse(200, { ...SALE, note: 'Entregar a la tarde', payment: 'cash' }),
  )
  renderDetalle()

  expect(await screen.findByText('Venta del 14/09')).toBeInTheDocument()
  expect(screen.getAllByText('$ 11.000')).toHaveLength(2) // the big total and the final Total row.
  expect(screen.getByText('Flor A')).toBeInTheDocument()
  expect(screen.getByText('lista')).toBeInTheDocument()
  expect(screen.getByText('3,5 g')).toBeInTheDocument()
  expect(screen.getByText('$ 3.000 por gramo')).toBeInTheDocument()
  expect(screen.getByText('$ 10.500')).toBeInTheDocument()
  expect(screen.getByText('$ 500')).toBeInTheDocument()
  expect(screen.getByText('Entregar a la tarde')).toBeInTheDocument()
  expect(screen.getByText('3,5 g · Ana Pérez · pagada en efectivo')).toBeInTheDocument()
})

test('a sale with no customer and no payment shows "Sin cliente" and drops the payment part', async () => {
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse(200, { ...SALE, customer: null, payment: 'none' }),
  )
  renderDetalle()

  expect(await screen.findByText('3,5 g · Sin cliente')).toBeInTheDocument()
})

test.each([
  ['cash', 'pagada en efectivo'],
  ['transfer', 'pagada por transferencia'],
  ['owing', 'quedó debiendo'],
] as const)('the summary line reads "%s" as "%s"', async (payment, words) => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { ...SALE, payment }))
  renderDetalle()

  expect(await screen.findByText(`3,5 g · Ana Pérez · ${words}`)).toBeInTheDocument()
})

test('a gone sale shows the plain gone-detail state, never the generic retry', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(404, { code: 'sale.not_found' }))
  renderDetalle()

  expect(await screen.findByText('Eso ya no está.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Volver a Ventas' })).toHaveAttribute('href', paths.sales())
})

test('Borrar venta asks "Antes de borrar" naming the date, the amount and the grams returning to stock, then deletes and returns to Ventas with the plain toast', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, SALE))
  vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, DELETED))
  renderDetalle()
  await screen.findByText('Venta del 14/09')

  await userEvent.click(screen.getByRole('button', { name: 'Borrar venta' }))
  expect(
    screen.getByText('¿Borrás la venta de $ 11.000 del 14/09? Vuelven 3,5 g al stock.'),
  ).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrala' }))

  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith('/sales/10', expect.objectContaining({ method: 'DELETE' })),
  )
  expect(await screen.findByText('lista de ventas')).toBeInTheDocument()
  expect(await screen.findByText('Venta eliminada')).toBeInTheDocument()
})

test('cancelling the delete confirmation keeps the sale', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, SALE))
  renderDetalle()
  await screen.findByText('Venta del 14/09')

  await userEvent.click(screen.getByRole('button', { name: 'Borrar venta' }))
  await userEvent.click(screen.getByRole('button', { name: 'No, dejala' }))

  expect(
    screen.queryByText('¿Borrás la venta de $ 11.000 del 14/09? Vuelven 3,5 g al stock.'),
  ).not.toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('right after a save, Deshacer deletes the sale with no confirmation and names the grams going back to stock', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, SALE))
  vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, DELETED))
  renderDetalle(saleJustSaved())
  await screen.findByText('Venta del 14/09')

  expect(screen.getByText('Venta guardada')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }))

  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith('/sales/10', expect.objectContaining({ method: 'DELETE' })),
  )
  expect(await screen.findByText('lista de ventas')).toBeInTheDocument()
  expect(
    screen.getByText('Venta eliminada · los gramos vuelven al stock'),
  ).toBeInTheDocument()
})

test('opening the detail without the just-saved marker never shows Deshacer', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, SALE))
  renderDetalle()
  await screen.findByText('Venta del 14/09')

  expect(screen.queryByText('Venta guardada')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Deshacer' })).not.toBeInTheDocument()
})

test('a sale already gone when deleted shows the gone notice and returns to Ventas', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, SALE))
  vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(404, { code: 'sale.not_found' }))
  renderDetalle()
  await screen.findByText('Venta del 14/09')

  await userEvent.click(screen.getByRole('button', { name: 'Borrar venta' }))
  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrala' }))

  expect(await screen.findByText('Eso ya no está. La lista ya está al día.')).toBeInTheDocument()
})

test('a sale with a customer already never shows Asignar cliente', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, SALE))
  renderDetalle()
  await screen.findByText('Venta del 14/09')

  expect(screen.queryByRole('button', { name: 'Asignar cliente' })).not.toBeInTheDocument()
})

const NICO_SEARCH_RESULT = { id: 5, name: 'Nico', phone: '1111', channel: 'whatsapp', vip: true }
const NICO = { id: 5, name: 'Nico', vip: true }

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
      'GET /sales/10': () =>
        jsonResponse(200, assigned ? { ...SALE, customer: NICO } : { ...SALE, customer: null, payment: 'none' }),
      'GET /customers?q=Nico': () => jsonResponse(200, [NICO_SEARCH_RESULT]),
      'PUT /sales/10/customer': () => {
        assigned = true
        return jsonResponse(200, { ...SALE, customer: NICO })
      },
    }),
  )
  renderDetalle()
  await screen.findByText('3,5 g · Sin cliente')

  await userEvent.click(screen.getByRole('button', { name: 'Asignar cliente' }))
  expect(screen.getByText('Elegir cliente')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Sin cliente' })).not.toBeInTheDocument()

  fireEvent.change(screen.getByPlaceholderText('Teléfono o nombre'), { target: { value: 'Nico' } })
  await userEvent.click(await screen.findByText('Nico'))

  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      '/sales/10/customer',
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
      'GET /sales/10': () =>
        jsonResponse(200, assignedAlready ? SALE : { ...SALE, customer: null, payment: 'none' }),
      'GET /customers?q=Nico': () => jsonResponse(200, [NICO_SEARCH_RESULT]),
      'PUT /sales/10/customer': () => {
        assignedAlready = true
        return jsonResponse(409, { code: 'sale.customer_already_assigned' })
      },
    }),
  )
  renderDetalle()
  await screen.findByText('3,5 g · Sin cliente')

  await userEvent.click(screen.getByRole('button', { name: 'Asignar cliente' }))
  fireEvent.change(screen.getByPlaceholderText('Teléfono o nombre'), { target: { value: 'Nico' } })
  await userEvent.click(await screen.findByText('Nico'))

  expect(await screen.findByText('Esta venta ya tiene cliente.')).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Asignar cliente' })).not.toBeInTheDocument())
})

test('assigning to a sale a partner deleted meanwhile shows the gone notice on Ventas', async () => {
  vi.mocked(fetch).mockImplementation(
    dispatchFetch({
      'GET /sales/10': () => jsonResponse(200, { ...SALE, customer: null, payment: 'none' }),
      'GET /customers?q=Nico': () => jsonResponse(200, [NICO_SEARCH_RESULT]),
      'PUT /sales/10/customer': () => jsonResponse(404, { code: 'sale.not_found' }),
    }),
  )
  renderDetalle()
  await screen.findByText('3,5 g · Sin cliente')

  await userEvent.click(screen.getByRole('button', { name: 'Asignar cliente' }))
  fireEvent.change(screen.getByPlaceholderText('Teléfono o nombre'), { target: { value: 'Nico' } })
  await userEvent.click(await screen.findByText('Nico'))

  expect(await screen.findByText('Eso ya no está. La lista ya está al día.')).toBeInTheDocument()
})

test('assigning a customer a partner deleted meanwhile shows the gone notice on Ventas', async () => {
  vi.mocked(fetch).mockImplementation(
    dispatchFetch({
      'GET /sales/10': () => jsonResponse(200, { ...SALE, customer: null, payment: 'none' }),
      'GET /customers?q=Nico': () => jsonResponse(200, [NICO_SEARCH_RESULT]),
      'PUT /sales/10/customer': () => jsonResponse(404, { code: 'sale.customer_not_found' }),
    }),
  )
  renderDetalle()
  await screen.findByText('3,5 g · Sin cliente')

  await userEvent.click(screen.getByRole('button', { name: 'Asignar cliente' }))
  fireEvent.change(screen.getByPlaceholderText('Teléfono o nombre'), { target: { value: 'Nico' } })
  await userEvent.click(await screen.findByText('Nico'))

  expect(await screen.findByText('Eso ya no está. La lista ya está al día.')).toBeInTheDocument()
})
