/**
 * `NuevaVenta` at the screen seam (`sales.md`, "On screen: Nueva venta"): the live
 * preview from `sales/pricing.ts`, the two pre-save checks (`validateSale`), the
 * customer/payment interlock, the leave guard, and that a successful save hands the
 * API's own answer to `navigate(..., { replace: true })` — never the preview. Routed
 * through the real app (`App`, the shared `router` singleton) so `useBlocker` runs
 * under the real data router, exactly as `App.test.tsx` already does for the stubs
 * this subtask replaces.
 */

import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import App from '../../App'
import { queryClient } from '../../queryClient'
import { router } from '../../router'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }

const ROSA = {
  id: 1,
  name: 'Rosa',
  current_price: { id: 9, effective_from: '2026-09-01', list_price: 1000, bulk_price: null, bulk_minimum: null },
}
const TULIPAN = { id: 2, name: 'Tulipán', current_price: null }

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function setupFetch(handlers: Record<string, () => Response>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((path: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const key = `${method} ${path}`
    const handler = handlers[key]
    if (handler === undefined) {
      return Promise.reject(new Error(`unexpected request: ${key}`))
    }
    return Promise.resolve(handler())
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function openForm(handlers: Record<string, () => Response>): Promise<ReturnType<typeof vi.fn>> {
  const fetchMock = setupFetch(handlers)
  await act(() => router.navigate('/ventas/nueva'))
  render(<App />)
  await screen.findByText('Nueva venta')
  return fetchMock
}

afterEach(async () => {
  vi.unstubAllGlobals()
  queryClient.clear()
  await act(() => router.navigate('/'))
})

test('the live preview prices a list line as the sale types, with no save call', async () => {
  const user = userEvent.setup()
  const fetchMock = await openForm({
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties?on=2026-10-02': () => jsonResponse(200, [ROSA, TULIPAN]),
  })

  await user.selectOptions(screen.getByLabelText('Variedad línea 1'), '1')
  await user.type(screen.getByLabelText('Gramos línea 1'), '2')

  expect(await screen.findByText('Lista')).toBeInTheDocument()
  expect(screen.getByText('$ 1.000 x g')).toBeInTheDocument()
  // Grams × price per gram, rounded half up (sales.md): 2 g × $1.000 = $2.000, both
  // the line total and (shipping still $0) the sale's own total.
  expect(screen.getAllByText('$ 2.000').length).toBeGreaterThanOrEqual(1)
  expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'POST')).toBe(
    false,
  )
})

test('a variety with no price that day shows its message and blocks saving', async () => {
  const user = userEvent.setup()
  const fetchMock = await openForm({
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties?on=2026-10-02': () => jsonResponse(200, [ROSA, TULIPAN]),
  })

  await user.selectOptions(screen.getByLabelText('Variedad línea 1'), '2')
  await user.type(screen.getByLabelText('Gramos línea 1'), '1')
  await user.click(screen.getByRole('radio', { name: 'Efectivo' }))

  expect(await screen.findByText('Tulipán no tiene precio para esa fecha')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Guardar venta' }))

  expect(fetchMock.mock.calls.some(([path, init]) => path === '/sales' && (init as RequestInit)?.method === 'POST')).toBe(
    false,
  )
})

test('Debiendo is disabled with no customer, enables once one is chosen, and resets on "Sin cliente"', async () => {
  const user = userEvent.setup()
  const ANA = { id: 5, name: 'Ana', phone: '+5491100000000', channel: null, vip: false }
  await openForm({
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties?on=2026-10-02': () => jsonResponse(200, [ROSA, TULIPAN]),
    'GET /customers': () => jsonResponse(200, [ANA]),
  })

  expect(screen.getByRole('radio', { name: 'Debiendo' })).toBeDisabled()
  expect(screen.getByText('Para dejar debiendo elegí un cliente')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Elegir cliente' }))
  await user.click(await screen.findByRole('button', { name: /Ana/ }))

  expect(await screen.findByText('Ana')).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Debiendo' })).toBeEnabled()
  await user.click(screen.getByRole('radio', { name: 'Debiendo' }))
  expect(screen.getByRole('radio', { name: 'Debiendo' })).toBeChecked()

  await user.click(screen.getByRole('button', { name: 'Cambiar' }))
  await user.click(await screen.findByRole('button', { name: 'Sin cliente' }))

  expect(screen.getByRole('radio', { name: 'Debiendo' })).toBeDisabled()
  expect(screen.getByRole('radio', { name: 'Debiendo' })).not.toBeChecked()
})

test('a successful save opens the sale the API answered with, replacing history', async () => {
  const user = userEvent.setup()
  await openForm({
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties?on=2026-10-02': () => jsonResponse(200, [ROSA, TULIPAN]),
    'POST /sales': () =>
      jsonResponse(201, {
        id: 42,
        date: '2026-10-02',
        customer: null,
        shipping_charged: 0,
        note: null,
        payment: 'cash',
        total: 2000,
        lines: [],
      }),
  })

  await user.selectOptions(screen.getByLabelText('Variedad línea 1'), '1')
  await user.type(screen.getByLabelText('Gramos línea 1'), '2')
  await user.click(screen.getByRole('radio', { name: 'Efectivo' }))
  await user.click(screen.getByRole('button', { name: 'Guardar venta' }))

  await waitFor(() => expect(router.state.location.pathname).toBe('/ventas/42'))
  expect(router.state.location.state).toEqual({ saleJustSaved: true })
})

test('an untouched form closes at once; a touched one asks "¿Descartás la venta?" first', async () => {
  const user = userEvent.setup()
  await openForm({
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties?on=2026-10-02': () => jsonResponse(200, [ROSA, TULIPAN]),
  })

  await user.click(screen.getByRole('button', { name: 'Cerrar' }))
  expect(await screen.findByText('Ventas')).toBeInTheDocument()

  await act(() => router.navigate('/ventas/nueva'))
  await screen.findByText('Nueva venta')
  await user.type(screen.getByLabelText('Gramos línea 1'), '2')
  await user.click(screen.getByRole('button', { name: 'Cerrar' }))

  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText('¿Descartás la venta?')).toBeInTheDocument()
  await user.click(within(dialog).getByRole('button', { name: 'No, seguí cargando' }))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(screen.getByText('Nueva venta')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Cerrar' }))
  const dialogAgain = await screen.findByRole('alertdialog')
  await user.click(within(dialogAgain).getByRole('button', { name: 'Sí, descartala' }))
  expect(await screen.findByText('Ventas')).toBeInTheDocument()
})
