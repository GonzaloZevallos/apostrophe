/**
 * `VariedadDetalle` at the screen seam (`varieties.md`, "On screen"): the price
 * history with "Rige desde", a new price entry, renaming, and deleting an entry
 * through the "Antes de borrar" confirmation. The API is faked at `../api/client`.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import * as client from '../api/client'
import { ApiError, NetworkError } from '../api/client'
import type { Me } from '../api/me'
import { GONE_DETAIL, GONE_NOTICE } from '../api/refusals'
import { SIN_CONEXION_TITULO } from '../components/SinConexion'
import VariedadDetalle from './VariedadDetalle'
import { paths } from '../routes/paths'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof client>('../api/client')
  return { ...actual, get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn(), put: vi.fn() }
})

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }

const VARIETY = { id: 1, name: '24K Gold', current_price: { id: 3, effective_from: '2026-09-25', list_price: 11000, bulk_price: 10000, bulk_minimum: 10 } }
const HISTORY = [
  { id: 3, effective_from: '2026-09-25', list_price: 11000, bulk_price: 10000, bulk_minimum: 10 },
  { id: 2, effective_from: '2026-09-01', list_price: 10500, bulk_price: null, bulk_minimum: null },
  { id: 1, effective_from: '2026-07-05', list_price: 9800, bulk_price: null, bulk_minimum: null },
]

function renderScreen() {
  // `retry: false`: a failed query must settle into `isError` on the first try, not
  // after react-query's default backoff, so the gone-detail test does not time out.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[paths.variety(1)]}>
        <Routes>
          <Route element={<Outlet context={ME} />}>
            <Route path={paths.variety(':id')} element={<VariedadDetalle />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const EMPTY_STOCK = { total: 0, varieties: [], entries: [] }

function mockGet(stock: unknown = EMPTY_STOCK) {
  vi.mocked(client.get).mockImplementation((path: string) => {
    if (path === '/varieties/1') return Promise.resolve(VARIETY)
    if (path === '/varieties/1/prices') return Promise.resolve(HISTORY)
    if (path === '/stock') return Promise.resolve(stock)
    return Promise.reject(new Error(`unexpected path: ${path}`))
  })
}

beforeEach(() => {
  vi.mocked(client.get).mockReset()
  vi.mocked(client.post).mockReset()
  vi.mocked(client.patch).mockReset()
  vi.mocked(client.del).mockReset()
  vi.mocked(client.put).mockReset()
})

test('shows the history, newest first, with "Rige desde" and "Vigente hoy" on the current one', async () => {
  mockGet()
  renderScreen()

  expect(await screen.findByText('24K Gold')).toBeInTheDocument()
  expect(screen.getByText('Vigente hoy')).toBeInTheDocument()
  expect(screen.getAllByText(/Rige desde/).length).toBeGreaterThanOrEqual(3)
})

test('renaming saves and toasts "Variedad guardada"', async () => {
  const user = userEvent.setup()
  mockGet()
  vi.mocked(client.patch).mockResolvedValue({ ...VARIETY, name: 'Oro 24K' })
  renderScreen()

  await screen.findByText('24K Gold')
  await user.click(screen.getByRole('button', { name: 'Editar' }))
  const input = screen.getByLabelText('Nombre')
  await user.clear(input)
  await user.type(input, 'Oro 24K')
  await user.click(screen.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByText('Variedad guardada')).toBeInTheDocument()
  expect(client.patch).toHaveBeenCalledWith('/varieties/1', { name: 'Oro 24K' })
})

test('a dropped network while renaming shows "Sin conexión", keeping what was typed', async () => {
  const user = userEvent.setup()
  mockGet()
  vi.mocked(client.patch).mockRejectedValue(new NetworkError())
  renderScreen()

  await screen.findByText('24K Gold')
  await user.click(screen.getByRole('button', { name: 'Editar' }))
  const input = screen.getByLabelText('Nombre')
  await user.clear(input)
  await user.type(input, 'Oro 24K')
  await user.click(screen.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByText(SIN_CONEXION_TITULO)).toBeInTheDocument()
  expect(screen.getByLabelText('Nombre')).toHaveValue('Oro 24K')
})

test('recording a new price entry saves and toasts "Precio guardado"', async () => {
  const user = userEvent.setup()
  mockGet()
  vi.mocked(client.post).mockResolvedValue({ id: 4, effective_from: '2026-10-02', list_price: 12000, bulk_price: null, bulk_minimum: null })
  renderScreen()

  await screen.findByText('24K Gold')
  await user.click(screen.getByRole('button', { name: 'Nuevo precio' }))
  await user.type(screen.getByLabelText('Precio de lista'), '12.000')
  await user.click(screen.getByRole('button', { name: 'Guardar precio' }))

  expect(await screen.findByText('Precio guardado')).toBeInTheDocument()
  expect(client.post).toHaveBeenCalledWith('/varieties/1/prices', expect.objectContaining({ list_price: 12000 }))
})

describe('deleting an entry', () => {
  test('confirms with what takes its place, then deletes and toasts "Precio eliminado"', async () => {
    const user = userEvent.setup()
    mockGet()
    vi.mocked(client.del).mockResolvedValue(undefined)
    renderScreen()

    await screen.findByText('24K Gold')
    const buttons = screen.getAllByRole('button', { name: 'Borrar este precio' })
    const deleteCurrent = buttons[0]
    if (deleteCurrent === undefined) throw new Error('expected at least one delete button')
    await user.click(deleteCurrent)

    expect(await screen.findByText('Vuelve a regir $ 10.500 x g desde el 01/09')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sí, borrala' }))

    expect(await screen.findByText('Precio eliminado')).toBeInTheDocument()
    expect(client.del).toHaveBeenCalledWith('/varieties/1/prices/3')
  })

  test('canceling keeps the entry and calls no API', async () => {
    const user = userEvent.setup()
    mockGet()
    renderScreen()

    await screen.findByText('24K Gold')
    const buttons = screen.getAllByRole('button', { name: 'Borrar este precio' })
    const deleteCurrent = buttons[0]
    if (deleteCurrent === undefined) throw new Error('expected at least one delete button')
    await user.click(deleteCurrent)
    await user.click(screen.getByRole('button', { name: 'No, dejala' }))

    expect(client.del).not.toHaveBeenCalled()
  })

  test('an entry already gone shows the gone notice instead of a success toast', async () => {
    const user = userEvent.setup()
    mockGet()
    vi.mocked(client.del).mockRejectedValue(new ApiError(404, 'variety.price_entry_not_found'))
    renderScreen()

    await screen.findByText('24K Gold')
    const buttons = screen.getAllByRole('button', { name: 'Borrar este precio' })
    const deleteCurrent = buttons[0]
    if (deleteCurrent === undefined) throw new Error('expected at least one delete button')
    await user.click(deleteCurrent)
    await user.click(screen.getByRole('button', { name: 'Sí, borrala' }))

    const notice = await screen.findByText(GONE_NOTICE)
    expect(notice).toBeInTheDocument()
    expect(screen.queryByText('Precio eliminado')).not.toBeInTheDocument()
    // This screen's own success toast (`AvisoExito`, "Precio guardado"/"Precio
    // eliminado") renders inline in `.cuerpo`, never floating — the gone notice
    // must match that, not Gastos/GastoCategorias's floating one (review
    // finding, e2e: GoneNotice no longer hard-codes a placement of its own).
    expect(notice.closest('.aviso-flotante')).toBeNull()
  })

  test('a dropped network shows "Sin conexión", never a success toast', async () => {
    const user = userEvent.setup()
    mockGet()
    vi.mocked(client.del).mockRejectedValue(new NetworkError())
    renderScreen()

    await screen.findByText('24K Gold')
    const buttons = screen.getAllByRole('button', { name: 'Borrar este precio' })
    const deleteCurrent = buttons[0]
    if (deleteCurrent === undefined) throw new Error('expected at least one delete button')
    await user.click(deleteCurrent)
    await user.click(screen.getByRole('button', { name: 'Sí, borrala' }))

    expect(await screen.findByText(SIN_CONEXION_TITULO)).toBeInTheDocument()
    expect(screen.queryByText('Precio eliminado')).not.toBeInTheDocument()
  })
})

describe('low-stock threshold', () => {
  test('setting it calls the threshold route and toasts "Aviso guardado"', async () => {
    const user = userEvent.setup()
    mockGet({
      total: 0,
      varieties: [{ variety_id: 1, grams: 0, status: 'no_entries', sold_out_since: null, threshold: null, days_left: null }],
      entries: [],
    })
    vi.mocked(client.put).mockResolvedValue({
      variety_id: 1,
      grams: 0,
      status: 'no_entries',
      sold_out_since: null,
      threshold: 15,
      days_left: null,
    })
    renderScreen()

    await screen.findByText('24K Gold')
    expect(await screen.findByText('Aviso apagado')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Umbral de aviso (g)'), '15')
    await user.click(screen.getByRole('button', { name: 'Guardar aviso' }))

    expect(await screen.findByText('Aviso guardado')).toBeInTheDocument()
    expect(client.put).toHaveBeenCalledWith('/stock/varieties/1/threshold', { grams: 15 })
  })

  test('turning it off calls the threshold route with null and toasts "Aviso guardado"', async () => {
    const user = userEvent.setup()
    mockGet({
      total: 0,
      varieties: [{ variety_id: 1, grams: 20, status: 'ok', sold_out_since: null, threshold: 15, days_left: null }],
      entries: [],
    })
    vi.mocked(client.put).mockResolvedValue({
      variety_id: 1,
      grams: 20,
      status: 'ok',
      sold_out_since: null,
      threshold: null,
      days_left: null,
    })
    renderScreen()

    await screen.findByText('24K Gold')
    expect(await screen.findByText('Avisame abajo de 15 g')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Apagar aviso' }))

    expect(await screen.findByText('Aviso guardado')).toBeInTheDocument()
    expect(client.put).toHaveBeenCalledWith('/stock/varieties/1/threshold', { grams: null })
  })

  test('an invalid threshold is refused inline, keeping what was typed', async () => {
    const user = userEvent.setup()
    mockGet({
      total: 0,
      varieties: [{ variety_id: 1, grams: 0, status: 'no_entries', sold_out_since: null, threshold: null, days_left: null }],
      entries: [],
    })
    renderScreen()

    await screen.findByText('24K Gold')
    await user.type(screen.getByLabelText('Umbral de aviso (g)'), '0')
    await user.click(screen.getByRole('button', { name: 'Guardar aviso' }))

    expect(client.put).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Umbral de aviso (g)')).toHaveValue('0')
  })

  test('a gone variety on save shows the gone notice', async () => {
    const user = userEvent.setup()
    mockGet({
      total: 0,
      varieties: [{ variety_id: 1, grams: 0, status: 'no_entries', sold_out_since: null, threshold: null, days_left: null }],
      entries: [],
    })
    vi.mocked(client.put).mockRejectedValue(new ApiError(404, 'variety.not_found'))
    renderScreen()

    await screen.findByText('24K Gold')
    await user.type(screen.getByLabelText('Umbral de aviso (g)'), '15')
    await user.click(screen.getByRole('button', { name: 'Guardar aviso' }))

    expect(await screen.findByText(GONE_NOTICE)).toBeInTheDocument()
  })
})

test('a variety that is gone shows the gone-detail state with a way back to the list', async () => {
  vi.mocked(client.get).mockRejectedValue(new ApiError(404, 'variety.not_found'))
  renderScreen()

  expect(await screen.findByText(GONE_DETAIL)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Volver a Variedades' })).toHaveAttribute(
    'href',
    paths.varieties(),
  )
})
