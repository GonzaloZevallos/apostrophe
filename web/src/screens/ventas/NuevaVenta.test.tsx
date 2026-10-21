/**
 * `NuevaVenta` at the screen seam (`sales.md`, "On screen: Nueva venta"): the live
 * preview from `sales/pricing.ts`, the two pre-save checks (`validateSale`), the
 * customer/payment interlock, the leave guard, and that a successful save hands the
 * API's own answer to `navigate(..., { replace: true })` — never the preview. Routed
 * through the real app (`App`, the shared `router` singleton) so `useBlocker` runs
 * under the real data router, exactly as `App.test.tsx` already does for the stubs
 * this subtask replaces.
 */

import { HOME, SALE, SALES, SALE_NEW, pathTo } from '../../routes'
import { inAppState } from '../../components/inAppState'
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
  // Via /ventas first, as the design's own "New sale" button always does
  // (`Inicio.dc.html`/`Ventas.dc.html`): the back chevron's `navigate(-1)` then
  // has something real to land on, the same page a seller actually came from.
  await act(() => router.navigate(SALES))
  await act(() => router.navigate(SALE_NEW))
  render(<App />)
  await screen.findByText('New sale')
  // The varieties arrive after the form mounts; a test that picks one straight away
  // races the fetch on a loaded machine, so wait until the first line can offer them.
  if (Object.keys(handlers).some((key) => key.startsWith('GET /varieties'))) {
    const picker = await screen.findByLabelText('Variedad línea 1')
    await waitFor(() => expect(within(picker).getAllByRole('option').length).toBeGreaterThan(1))
  }
  return fetchMock
}

afterEach(async () => {
  vi.unstubAllGlobals()
  queryClient.clear()
  await act(() => router.navigate(HOME))
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
  await user.click(screen.getByRole('radio', { name: 'Cash' }))

  expect(await screen.findByText('Tulipán no tiene precio para esa fecha')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Guardá la venta' }))

  expect(fetchMock.mock.calls.some(([path, init]) => path === '/sales' && (init as RequestInit)?.method === 'POST')).toBe(
    false,
  )
})

test('Debiendo is disabled with no customer, enables once one is chosen, and resets on "Sin cliente"', async () => {
  const user = userEvent.setup()
  const ANA = { id: 5, name: 'Ana', phone: '+5491100000000', vip: false }
  await openForm({
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties?on=2026-10-02': () => jsonResponse(200, [ROSA, TULIPAN]),
    'GET /customers': () => jsonResponse(200, [ANA]),
  })

  expect(screen.getByRole('radio', { name: 'Owing' })).toBeDisabled()
  expect(screen.getByText('Para dejar debiendo elegí un cliente')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Elegir cliente' }))
  await user.click(await screen.findByRole('button', { name: /Ana/ }))

  expect(await screen.findByText('Ana')).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Owing' })).toBeEnabled()
  await user.click(screen.getByRole('radio', { name: 'Owing' }))
  expect(screen.getByRole('radio', { name: 'Owing' })).toBeChecked()

  // The whole customer row is one tappable `Boton` now (name, phone, "Change"),
  // not a dead name next to a separate link — its accessible name is the row's
  // full text, "Change" only a part of it.
  await user.click(screen.getByRole('button', { name: /Change/ }))
  await user.click(await screen.findByRole('button', { name: 'Sin cliente' }))

  expect(screen.getByRole('radio', { name: 'Owing' })).toBeDisabled()
  expect(screen.getByRole('radio', { name: 'Owing' })).not.toBeChecked()
})

test('a customer with no phone shows no phone element in Elegir cliente nor the chosen chip', async () => {
  const user = userEvent.setup()
  const SOL = { id: 6, name: 'Sol', phone: null, vip: false }
  await openForm({
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties?on=2026-10-02': () => jsonResponse(200, [ROSA, TULIPAN]),
    'GET /customers': () => jsonResponse(200, [SOL]),
  })

  await user.click(screen.getByRole('button', { name: 'Elegir cliente' }))
  const resultRow = await screen.findByRole('button', { name: /Sol/ })
  expect(resultRow.querySelector('.lista-clientes__telefono')).toBeNull()

  await user.click(resultRow)

  const chip = await screen.findByRole('button', { name: /Sol/ })
  expect(chip.querySelector('.nueva-venta__cliente-telefono')).toBeNull()
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
    // never the preview, and shows "Sale saved" once it reads the marker
    // `NuevaVenta` navigated with — this is that detail fetch, not a second
    // sale.
    'GET /sales/42': () => jsonResponse(200, savedSale),
  })

  await user.selectOptions(screen.getByLabelText('Variedad línea 1'), '1')
  await user.type(screen.getByLabelText('Gramos línea 1'), '2')
  await user.click(screen.getByRole('radio', { name: 'Cash' }))
  await user.click(screen.getByRole('button', { name: 'Guardá la venta' }))

  await waitFor(() => expect(router.state.location.pathname).toBe(pathTo(SALE, { id: 42 })))
  expect(await screen.findByText('Sale saved')).toBeInTheDocument()
})

test('the form closes with "Close" and shows no back control named "Volver"', async () => {
  await openForm({
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties?on=2026-10-02': () => jsonResponse(200, [ROSA, TULIPAN]),
  })

  expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Volver' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Volver' })).not.toBeInTheDocument()
})

test('with no history behind it, "Close" replaces the form with Ventas instead of pushing it', async () => {
  const user = userEvent.setup()
  setupFetch({
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties?on=2026-10-02': () => jsonResponse(200, [ROSA, TULIPAN]),
    'GET /sales?date_from=2026-10-02&date_to=2026-10-02': () => jsonResponse(200, []),
  })
  await act(() => router.navigate(SALE_NEW))
  render(<App />)
  await screen.findByText('New sale')

  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(
    await screen.findByText('Sales', { selector: '.encabezado__titulo' }),
  ).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(SALES)

  await act(() => router.navigate(-1))
  expect(router.state.location.pathname).not.toBe(SALE_NEW)
})

test('opened from inside the app, "Close" goes back through history', async () => {
  const user = userEvent.setup()
  setupFetch({
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties?on=2026-10-02': () => jsonResponse(200, [ROSA, TULIPAN]),
    'GET /sales?date_from=2026-10-02&date_to=2026-10-02': () => jsonResponse(200, []),
  })
  await act(() => router.navigate(SALES))
  await act(() => router.navigate(SALE_NEW, { state: inAppState({ pathname: SALES }) }))
  render(<App />)
  await screen.findByText('New sale')

  await user.click(screen.getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(router.state.location.pathname).toBe(SALES))
  expect(router.state.location.state).toBeNull()
})

test('an untouched form closes at once; a touched one asks "¿Descartás la venta?" first', async () => {
  const user = userEvent.setup()
  await openForm({
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties?on=2026-10-02': () => jsonResponse(200, [ROSA, TULIPAN]),
    // Closing lands back on `Ventas` (sales-list-and-detail), whose own
    // "Today" period fetches this range from `me.today`.
    'GET /sales?date_from=2026-10-02&date_to=2026-10-02': () => jsonResponse(200, []),
  })

  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(
    await screen.findByText('Sales', { selector: '.encabezado__titulo' }),
  ).toBeInTheDocument()

  await act(() => router.navigate(SALE_NEW))
  await screen.findByText('New sale')
  await user.type(screen.getByLabelText('Gramos línea 1'), '2')
  await user.click(screen.getByRole('button', { name: 'Close' }))

  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByText('¿Descartás la venta?')).toBeInTheDocument()
  await user.click(within(dialog).getByRole('button', { name: 'No, keep entering' }))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(screen.getByText('New sale')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Close' }))
  const dialogAgain = await screen.findByRole('alertdialog')
  await user.click(within(dialogAgain).getByRole('button', { name: 'Yes, discard it' }))
  expect(
    await screen.findByText('Sales', { selector: '.encabezado__titulo' }),
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
  await user.click(screen.getByRole('radio', { name: 'Cash' }))
  await user.type(screen.getByLabelText('Note'), 'una nota bien larga')
  await user.click(screen.getByRole('button', { name: 'Guardá la venta' }))

  expect(await screen.findByText('La nota es demasiado larga')).toBeInTheDocument()
  expect(screen.getByLabelText('Variedad línea 1')).toHaveValue('1')
  expect(screen.getByLabelText('Gramos línea 1')).toHaveValue('2')
  expect(screen.getByLabelText('Note')).toHaveValue('una nota bien larga')
  expect(screen.getByRole('radio', { name: 'Cash' })).toBeChecked()
  expect(screen.getByText('New sale')).toBeInTheDocument()
})

test('sale.payment_required shows its own message on "How it was paid", not the generic banner', async () => {
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
  await user.click(screen.getByRole('radio', { name: 'Cash' }))
  expect(await screen.findByText('lista')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Guardá la venta' }))

  expect(await screen.findByText('Rosa no tiene precio para esa fecha')).toBeInTheDocument()
  expect(varietiesCalls).toBe(2)
})

test('sale.no_price_that_day opens the flagged line even when it was closed', async () => {
  const user = userEvent.setup()
  let varietiesCalls = 0
  const CLAVEL = {
    id: 3,
    name: 'Clavel',
    current_price: { id: 10, effective_from: '2026-09-01', list_price: 500, bulk_price: null, bulk_minimum: null },
  }
  await openForm({
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties?on=2026-10-02': () => {
      varietiesCalls += 1
      // Same partner-deletes-the-price race as the test above, but Rosa's own
      // line is no longer the one open when the refusal lands — Clavel's is,
      // since "Add another variety" closes whatever was open.
      const rosa = varietiesCalls === 1 ? ROSA : { ...ROSA, current_price: null }
      return jsonResponse(200, [rosa, CLAVEL])
    },
    'POST /sales': () => jsonResponse(422, { detail: 'no price', code: 'sale.no_price_that_day' }),
  })

  await user.selectOptions(screen.getByLabelText('Variedad línea 1'), '1')
  await user.type(screen.getByLabelText('Gramos línea 1'), '2')
  await user.click(screen.getByRole('button', { name: 'Add another variety' }))
  await user.selectOptions(screen.getByLabelText('Variedad línea 2'), '3')
  await user.type(screen.getByLabelText('Gramos línea 2'), '1')
  await user.click(screen.getByRole('radio', { name: 'Cash' }))

  // Line 1 (Rosa) is closed now; line 2 (Clavel) is the open one.
  expect(screen.queryByLabelText('Variedad línea 1')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Guardá la venta' }))

  // The refusal names Rosa — line 1 must open back up, its own fields on
  // screen again, not just its message floating somewhere on the page.
  expect(await screen.findByText('Rosa no tiene precio para esa fecha')).toBeInTheDocument()
  expect(screen.getByLabelText('Variedad línea 1')).toBeInTheDocument()
  expect(screen.getByLabelText('Gramos línea 1')).toHaveValue('2')
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
  await user.click(screen.getByRole('radio', { name: 'Cash' }))

  await user.click(screen.getByRole('button', { name: 'Guardá la venta' }))
  expect(await screen.findByText('Revisá los datos e intentá de nuevo.')).toBeInTheDocument()
  expect(screen.getByText('New sale')).toBeInTheDocument()
  expect(screen.getByLabelText('Gramos línea 1')).toHaveValue('2')

  await user.click(screen.getByRole('button', { name: 'Guardá la venta' }))
  expect(await screen.findByText('Revisá los datos e intentá de nuevo.')).toBeInTheDocument()
  expect(screen.getByText('New sale')).toBeInTheDocument()
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
  // meanwhile. The form is touched, so "Close" asks first.
  await user.click(screen.getByRole('button', { name: 'Close' }))
  await user.click(await screen.findByRole('button', { name: 'Yes, discard it' }))
  await screen.findByText('Sales', { selector: '.encabezado__titulo' })
  listPrice = 5000

  // `gcTime: 0`'s own eviction runs off a timer this test does not control; this
  // mount's cache entry is cleared here instead, deterministically, so the next
  // fetch — reading `listPrice` fresh — is the one this assertion prices, never
  // the one the previous mount already cached.
  queryClient.clear()
  await act(() => router.navigate(SALE_NEW))
  await screen.findByText('New sale')
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

  await user.click(screen.getByRole('radio', { name: 'Cash' }))
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

test('"Nueva venta a <name>" prices a VIP customer at the VIP price below the bulk minimum', async () => {
  const user = userEvent.setup()
  const VIP_ANA = { id: 7, name: 'Ana VIP', phone: '+5491100000001', vip: true }
  const WITH_BULK = {
    id: 3,
    name: 'Jazmín',
    current_price: { id: 11, effective_from: '2026-09-01', list_price: 1000, bulk_price: 800, bulk_minimum: 10, vip_price: 700 },
  }
  setupFetch({
    'GET /auth/me': () => jsonResponse(200, ME),
    'GET /varieties?on=2026-10-02': () => jsonResponse(200, [WITH_BULK]),
    'GET /customers/7': () => jsonResponse(200, VIP_ANA),
    'GET /pricing-settings': () => jsonResponse(200, { is_bulk_pricing: true, is_vip_customers: true }),
  })
  await act(() => router.navigate(SALE_NEW, { state: { customerId: '7' } }))
  render(<App />)
  await screen.findByText('New sale')

  expect(await screen.findByText('Ana VIP')).toBeInTheDocument()
  expect(screen.getByText('VIP')).toBeInTheDocument()

  await user.selectOptions(screen.getByLabelText('Variedad línea 1'), '3')
  await user.type(screen.getByLabelText('Gramos línea 1'), '1')

  // Below the bulk minimum (10 g), the VIP price is still the lowest rule that applies (sales.md).
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
  await user.click(screen.getByRole('button', { name: 'Add another variety' }))

  // Line 2 opened empty, closed line 1 (now its own row), and — without typing
  // anything into line 2 — "Add another variety" again must not leave two
  // closed rows plus a third open line: the untouched line 2 is removed rather
  // than kept (plan, "Line editor"), so there is still exactly one closed row.
  expect(screen.getByLabelText('Variedad línea 2')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /^Línea \d/ })).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: 'Add another variety' }))

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
  await user.click(screen.getByRole('button', { name: 'Add another variety' }))
  await user.selectOptions(screen.getByLabelText('Variedad línea 2'), '2')
  await user.type(screen.getByLabelText('Gramos línea 2'), '1')
  await user.click(screen.getByRole('radio', { name: 'Cash' }))

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
  await user.click(screen.getByRole('radio', { name: 'Cash' }))
  await user.click(screen.getByRole('button', { name: 'Guardá la venta' }))

  expect(await screen.findByText('Revisá los datos e intentá de nuevo.')).toBeInTheDocument()
  expect(screen.getByLabelText('Variedad línea 1')).toHaveValue('1')
  expect(screen.getByLabelText('Gramos línea 1')).toHaveValue('2')
})
