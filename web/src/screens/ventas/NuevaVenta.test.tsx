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
import SALE_DETAIL from '../../api/fixtures/sale-detail.json'
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
  // Via `/ventas` first, as the design's own "Nueva venta" button always does
  // (`Inicio.dc.html`/`Ventas.dc.html`): the back chevron's `navigate(-1)` then
  // has something real to land on, the same page a seller actually came from.
  await act(() => router.navigate('/ventas'))
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

  expect(await screen.findByText('lista')).toBeInTheDocument()
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

  await user.click(screen.getByRole('button', { name: 'Guardá la venta' }))

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

  expect(screen.getByRole('radio', { name: 'Debiendo' })).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByText('Para dejar debiendo elegí un cliente')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Elegir cliente' }))
  await user.click(await screen.findByRole('button', { name: /Ana/ }))

  expect(await screen.findByText('Ana')).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Debiendo' })).toHaveAttribute('aria-disabled', 'false')
  await user.click(screen.getByRole('radio', { name: 'Debiendo' }))
  expect(screen.getByRole('radio', { name: 'Debiendo' })).toBeChecked()

  await user.click(screen.getByRole('button', { name: 'Cambiar' }))
  await user.click(await screen.findByRole('button', { name: 'Sin cliente' }))

  expect(screen.getByRole('radio', { name: 'Debiendo' })).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByRole('radio', { name: 'Debiendo' })).not.toBeChecked()
})

test('a successful save opens the sale the API answered with, replacing history', async () => {
  const user = userEvent.setup()
  // The API's own detail shape (`sale-detail.json`), not a hand-written stand-in:
  // `VentaDetalle` renders `GET /sales/42`'s own answer, `total_grams` included.
  const savedSale = { ...SALE_DETAIL, id: 42 }
  await openForm({
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties?on=2026-10-02': () => jsonResponse(200, [ROSA, TULIPAN]),
    'POST /sales': () => jsonResponse(201, savedSale),
    // `VentaDetalle` (sales-list-and-detail) renders what the API answered,
    // never the preview, and shows "Venta guardada" once it reads the marker
    // `NuevaVenta` navigated with — this is that detail fetch, not a second
    // sale.
    'GET /sales/42': () => jsonResponse(200, savedSale),
  })

  await user.selectOptions(screen.getByLabelText('Variedad línea 1'), '1')
  await user.type(screen.getByLabelText('Gramos línea 1'), '2')
  await user.click(screen.getByRole('radio', { name: 'Efectivo' }))
  await user.click(screen.getByRole('button', { name: 'Guardá la venta' }))

  await waitFor(() => expect(router.state.location.pathname).toBe('/ventas/42'))
  expect(await screen.findByText('Venta guardada')).toBeInTheDocument()
})

test('an untouched form closes at once; a touched one asks "¿Descartás la venta?" first', async () => {
  const user = userEvent.setup()
  await openForm({
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties?on=2026-10-02': () => jsonResponse(200, [ROSA, TULIPAN]),
    // Closing lands back on `Ventas` (sales-list-and-detail), whose own
    // "Hoy" period fetches this range from `me.today`.
    'GET /sales?date_from=2026-10-02&date_to=2026-10-02': () => jsonResponse(200, []),
  })

  await user.click(screen.getByRole('button', { name: 'Volver' }))
  expect(
    await screen.findByText('Ventas', { selector: '.encabezado__titulo' }),
  ).toBeInTheDocument()

  await act(() => router.navigate('/ventas/nueva'))
  await screen.findByText('Nueva venta')
  await user.type(screen.getByLabelText('Gramos línea 1'), '2')
  await user.click(screen.getByRole('button', { name: 'Volver' }))

  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText('¿Descartás la venta?')).toBeInTheDocument()
  await user.click(within(dialog).getByRole('button', { name: 'No, seguí cargando' }))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(screen.getByText('Nueva venta')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Volver' }))
  const dialogAgain = await screen.findByRole('alertdialog')
  await user.click(within(dialogAgain).getByRole('button', { name: 'Sí, descartala' }))
  expect(
    await screen.findByText('Ventas', { selector: '.encabezado__titulo' }),
  ).toBeInTheDocument()
})

test('a refused save keeps everything typed, the message on its field', async () => {
  const user = userEvent.setup()
  await openForm({
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties?on=2026-10-02': () => jsonResponse(200, [ROSA, TULIPAN]),
    'POST /sales': () => jsonResponse(422, { detail: 'too long', code: 'sale.note_too_long' }),
  })

  await user.selectOptions(screen.getByLabelText('Variedad línea 1'), '1')
  await user.type(screen.getByLabelText('Gramos línea 1'), '2')
  await user.click(screen.getByRole('radio', { name: 'Efectivo' }))
  await user.type(screen.getByLabelText('Nota'), 'una nota bien larga')
  await user.click(screen.getByRole('button', { name: 'Guardá la venta' }))

  expect(await screen.findByText('La nota es demasiado larga')).toBeInTheDocument()
  expect(screen.getByLabelText('Variedad línea 1')).toHaveValue('1')
  expect(screen.getByLabelText('Gramos línea 1')).toHaveValue('2')
  expect(screen.getByLabelText('Nota')).toHaveValue('una nota bien larga')
  expect(screen.getByRole('radio', { name: 'Efectivo' })).toBeChecked()
  expect(screen.getByText('Nueva venta')).toBeInTheDocument()
})

test('sale.payment_required shows its own message on "Cómo se pagó", not the generic banner', async () => {
  const user = userEvent.setup()
  await openForm({
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties?on=2026-10-02': () => jsonResponse(200, [ROSA, TULIPAN]),
    'POST /sales': () => jsonResponse(422, { detail: 'needs a method', code: 'sale.payment_required' }),
  })

  await user.selectOptions(screen.getByLabelText('Variedad línea 1'), '1')
  await user.type(screen.getByLabelText('Gramos línea 1'), '2')
  await user.click(screen.getByRole('button', { name: 'Guardá la venta' }))

  const message = await screen.findByText('Elegí cómo se pagó, o dejá la venta debiendo')
  expect(message.closest('.nueva-venta__pago')).not.toBeNull()
  expect(screen.queryByText('Revisá los datos e intentá de nuevo.')).not.toBeInTheDocument()
})

test('sale.no_price_that_day refetches prices, and the line then shows its own message', async () => {
  const user = userEvent.setup()
  let varietiesCalls = 0
  await openForm({
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties?on=2026-10-02': () => {
      varietiesCalls += 1
      // A partner deletes Rosa's price between this form's own fetch and the save
      // (sales.md): the second answer, after the refetch the refusal triggers, has
      // no current price any more.
      const rosa = varietiesCalls === 1 ? ROSA : { ...ROSA, current_price: null }
      return jsonResponse(200, [rosa])
    },
    'POST /sales': () => jsonResponse(422, { detail: 'no price', code: 'sale.no_price_that_day' }),
  })

  await user.selectOptions(screen.getByLabelText('Variedad línea 1'), '1')
  await user.type(screen.getByLabelText('Gramos línea 1'), '2')
  await user.click(screen.getByRole('radio', { name: 'Efectivo' }))
  expect(await screen.findByText('lista')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Guardá la venta' }))

  expect(await screen.findByText('Rosa no tiene precio para esa fecha')).toBeInTheDocument()
  expect(varietiesCalls).toBe(2)
})

test('sale.customer_not_found and sale.variety_not_found keep the form open with the generic line', async () => {
  const user = userEvent.setup()
  const codes = ['sale.customer_not_found', 'sale.variety_not_found']
  let call = 0
  await openForm({
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties?on=2026-10-02': () => jsonResponse(200, [ROSA, TULIPAN]),
    'POST /sales': () => {
      const code = codes[call] ?? codes[codes.length - 1]
      call += 1
      return jsonResponse(404, { detail: 'gone', code })
    },
  })

  await user.selectOptions(screen.getByLabelText('Variedad línea 1'), '1')
  await user.type(screen.getByLabelText('Gramos línea 1'), '2')
  await user.click(screen.getByRole('radio', { name: 'Efectivo' }))

  await user.click(screen.getByRole('button', { name: 'Guardá la venta' }))
  expect(await screen.findByText('Revisá los datos e intentá de nuevo.')).toBeInTheDocument()
  expect(screen.getByText('Nueva venta')).toBeInTheDocument()
  expect(screen.getByLabelText('Gramos línea 1')).toHaveValue('2')

  await user.click(screen.getByRole('button', { name: 'Guardá la venta' }))
  expect(await screen.findByText('Revisá los datos e intentá de nuevo.')).toBeInTheDocument()
  expect(screen.getByText('Nueva venta')).toBeInTheDocument()
  expect(screen.getByLabelText('Gramos línea 1')).toHaveValue('2')
})

test('nothing an earlier mount cached ever renders: a remount with a different price fetches fresh', async () => {
  const user = userEvent.setup()
  let listPrice = 1000
  await openForm({
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties?on=2026-10-02': () =>
      jsonResponse(200, [{ ...ROSA, current_price: { ...ROSA.current_price, list_price: listPrice } }]),
    'GET /sales?date_from=2026-10-02&date_to=2026-10-02': () => jsonResponse(200, []),
  })

  await user.selectOptions(screen.getByLabelText('Variedad línea 1'), '1')
  await user.type(screen.getByLabelText('Gramos línea 1'), '2')
  expect(await screen.findByText('$ 1.000 x g')).toBeInTheDocument()

  // Leave (unmounting NuevaVenta — `gcTime: 0` evicts its frozen query right away)
  // and change what the next fetch answers with, as if a partner had repriced Rosa
  // meanwhile. The form is touched, so "Cerrar" asks first.
  await user.click(screen.getByRole('button', { name: 'Volver' }))
  await user.click(await screen.findByRole('button', { name: 'Sí, descartala' }))
  await screen.findByText('Ventas', { selector: '.encabezado__titulo' })
  listPrice = 5000

  // `gcTime: 0`'s own eviction runs off a timer this test does not control; this
  // mount's cache entry is cleared here instead, deterministically, so the next
  // fetch — reading `listPrice` fresh — is the one this assertion prices, never
  // the one the previous mount already cached.
  queryClient.clear()
  await act(() => router.navigate('/ventas/nueva'))
  await screen.findByText('Nueva venta')
  await user.selectOptions(await screen.findByLabelText('Variedad línea 1'), '1')
  await user.type(screen.getByLabelText('Gramos línea 1'), '2')

  expect(await screen.findByText('$ 5.000 x g')).toBeInTheDocument()
  expect(screen.queryByText('$ 1.000 x g')).not.toBeInTheDocument()
})

test('a $0 special price is refused rather than silently priced at list, and Regalo/Especial exclude each other', async () => {
  const user = userEvent.setup()
  const fetchMock = await openForm({
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties?on=2026-10-02': () => jsonResponse(200, [ROSA, TULIPAN]),
  })

  await user.selectOptions(screen.getByLabelText('Variedad línea 1'), '1')
  await user.type(screen.getByLabelText('Gramos línea 1'), '2')
  expect(await screen.findByText('lista')).toBeInTheDocument()

  await user.type(screen.getByLabelText('Precio especial línea 1'), '0')
  expect(await screen.findByText('El precio especial tiene que ser mayor a $0')).toBeInTheDocument()
  expect(screen.queryByText('lista')).not.toBeInTheDocument()
  expect(screen.queryByText('especial')).not.toBeInTheDocument()
  expect(screen.getByLabelText(`Regalo línea 1`)).toBeDisabled()

  await user.click(screen.getByRole('radio', { name: 'Efectivo' }))
  await user.click(screen.getByRole('button', { name: 'Guardá la venta' }))
  expect(fetchMock.mock.calls.some(([path, init]) => path === '/sales' && (init as RequestInit)?.method === 'POST')).toBe(
    false,
  )

  await user.clear(screen.getByLabelText('Precio especial línea 1'))
  expect(screen.queryByText('El precio especial tiene que ser mayor a $0')).not.toBeInTheDocument()
  expect(await screen.findByText('lista')).toBeInTheDocument()
  expect(screen.getByLabelText('Regalo línea 1')).toBeEnabled()

  await user.type(screen.getByLabelText('Precio especial línea 1'), '500')
  expect(await screen.findByText('especial')).toBeInTheDocument()
  expect(screen.getByLabelText('Regalo línea 1')).toBeDisabled()
})

test('"Nueva venta a <name>" prices a VIP customer at the bulk rate below the bulk minimum', async () => {
  const user = userEvent.setup()
  const VIP_ANA = { id: 7, name: 'Ana VIP', phone: '+5491100000001', channel: null, vip: true }
  const WITH_BULK = {
    id: 3,
    name: 'Jazmín',
    current_price: { id: 11, effective_from: '2026-09-01', list_price: 1000, bulk_price: 700, bulk_minimum: 10 },
  }
  setupFetch({
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties?on=2026-10-02': () => jsonResponse(200, [WITH_BULK]),
    'GET /customers/7': () => jsonResponse(200, VIP_ANA),
  })
  await act(() => router.navigate('/ventas/nueva', { state: { customerId: '7' } }))
  render(<App />)
  await screen.findByText('Nueva venta')

  expect(await screen.findByText('Ana VIP')).toBeInTheDocument()
  expect(screen.getByText('VIP')).toBeInTheDocument()

  await user.selectOptions(screen.getByLabelText('Variedad línea 1'), '3')
  await user.type(screen.getByLabelText('Gramos línea 1'), '1')

  // Below the bulk minimum (10 g), but VIP takes the bulk price anyway (sales.md).
  // Two "VIP"s now: the customer's own badge, and the line's rule badge.
  await waitFor(() => expect(screen.getAllByText('VIP').length).toBeGreaterThanOrEqual(2))
  expect(screen.getByText('$ 700 x g')).toBeInTheDocument()
})

test('an untouched second line is removed once it closes', async () => {
  const user = userEvent.setup()
  await openForm({
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties?on=2026-10-02': () => jsonResponse(200, [ROSA, TULIPAN]),
  })

  await user.selectOptions(screen.getByLabelText('Variedad línea 1'), '1')
  await user.type(screen.getByLabelText('Gramos línea 1'), '2')
  await user.click(screen.getByRole('button', { name: 'Agregar otra variedad' }))

  // Line 2 opened empty, closed line 1 (now its own row), and — without typing
  // anything into line 2 — "Agregar otra variedad" again must not leave two
  // closed rows plus a third open line: the untouched line 2 is removed rather
  // than kept (plan, "Line editor"), so there is still exactly one closed row.
  expect(screen.getByLabelText('Variedad línea 2')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /^Línea \d/ })).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: 'Agregar otra variedad' }))

  expect(screen.getAllByRole('button', { name: /^Línea \d/ })).toHaveLength(1)
  expect(screen.getAllByLabelText(/^Variedad línea/)).toHaveLength(1)
})

test('a closed line with bad grams shows its own message and opens on save, with no request sent', async () => {
  const user = userEvent.setup()
  const fetchMock = await openForm({
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties?on=2026-10-02': () => jsonResponse(200, [ROSA, TULIPAN]),
  })

  await user.selectOptions(screen.getByLabelText('Variedad línea 1'), '1')
  await user.type(screen.getByLabelText('Gramos línea 1'), 'abc')
  await user.click(screen.getByRole('button', { name: 'Agregar otra variedad' }))
  await user.selectOptions(screen.getByLabelText('Variedad línea 2'), '2')
  await user.type(screen.getByLabelText('Gramos línea 2'), '1')
  await user.click(screen.getByRole('radio', { name: 'Efectivo' }))

  // Line 1, now closed, shows its message under the row rather than figures.
  expect(await screen.findByText('Cargá los gramos: coma, hasta dos decimales')).toBeInTheDocument()
  expect(screen.queryByLabelText('Variedad línea 1')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Guardá la venta' }))

  // Saving opens line 1 back up and focuses its Gramos field — the API is never
  // asked to refuse what the front already caught.
  const gramos1 = await screen.findByLabelText('Gramos línea 1')
  expect(gramos1).toHaveFocus()
  expect(fetchMock.mock.calls.some(([path, init]) => path === '/sales' && (init as RequestInit)?.method === 'POST')).toBe(
    false,
  )
})

test('a forced sale.grams_invalid answer keeps everything typed, the message at form level, and opens no line', async () => {
  const user = userEvent.setup()
  await openForm({
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties?on=2026-10-02': () => jsonResponse(200, [ROSA, TULIPAN]),
    'POST /sales': () => jsonResponse(422, { detail: 'bad grams', code: 'sale.grams_invalid' }),
  })

  await user.selectOptions(screen.getByLabelText('Variedad línea 1'), '1')
  await user.type(screen.getByLabelText('Gramos línea 1'), '2')
  await user.click(screen.getByRole('radio', { name: 'Efectivo' }))
  await user.click(screen.getByRole('button', { name: 'Guardá la venta' }))

  expect(await screen.findByText('Revisá los datos e intentá de nuevo.')).toBeInTheDocument()
  expect(screen.getByLabelText('Variedad línea 1')).toHaveValue('1')
  expect(screen.getByLabelText('Gramos línea 1')).toHaveValue('2')
})
