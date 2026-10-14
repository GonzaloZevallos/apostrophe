/**
 * `Shell` with each card's real page (GH-135, B2): the page is mounted under the shell's own
 * route subtree (taken from `router.tsx`, so no page is wired twice) with `fetch` faked well
 * enough for every card to reach its loaded header, the place the old in-page arrow lived.
 * Each case waits for the page's own content before it counts, so a page that drew its own
 * arrow again would show two. On both viewports: every card has exactly one back control,
 * drawn by the shell; a computer's two-pane detail adds none of its own and keeps the
 * sidebar's "+ Nueva venta"; no other card shows "+ Nueva venta" at all; an archived variety
 * reads "‹ Archivadas" on the phone; the "Ver todas" lists read "‹ <variety>"; and the arrow
 * of the standalone cards goes back by history, or to the parent with none.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider, type RouteObject } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../api/me'
import account from '../api/fixtures/account.json'
import customer from '../api/fixtures/customer.json'
import sale from '../api/fixtures/sale-detail.json'
import withdrawal from '../api/fixtures/withdrawal.json'
import { inAppState } from '../components/inAppState'
import { SheetRouterProvider } from '../components/useSheetStack'
import FlashProvider from '../flash/FlashProvider'
import { router as appRouter } from '../router'
import { pathTo, SCREENS, STOCK, VARIETIES, VARIETY, VARIETY_ENTRIES, VARIETY_PRICES, WITHDRAWAL, type ScreenId } from '../routes'
import Shell from './Shell'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03' }

const viewport = vi.hoisted(() => ({ current: 'phone' as 'phone' | 'computer' }))

vi.mock('./useViewport', () => ({ useViewport: () => viewport.current }))

function shellRoute(routes: RouteObject[]): RouteObject | undefined {
  for (const route of routes) {
    if (route.element !== undefined && (route.element as { type?: unknown }).type === Shell) return route
    const inner = shellRoute(route.children ?? [])
    if (inner !== undefined) return inner
  }
  return undefined
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const ENTRY = {
  id: 12,
  date: '2026-10-02',
  variety_id: 1,
  origin: 'purchase',
  grams: 30,
  total_cost: 150000,
  cost_per_gram: 5000,
  note: null,
}
const PRICE = { id: 3, effective_from: '2026-09-25', list_price: 11000, bulk_price: 10000, bulk_minimum: 10, vip_price: 9000 }
const CATALOG = {
  text: 'texto',
  header: '',
  footer: '',
  varieties: [
    { id: 1, name: '24K Gold', emoji: null, indica_share: 60, aroma: 'cítrico', shown: true, state: 'in' },
    { id: 2, name: 'Sir Jack', emoji: null, indica_share: null, aroma: null, shown: false, state: 'hidden' },
  ],
}
const PINNED = {
  token_saved_on: null,
  own_chat: null,
  channel_chat: null,
  can_publish: false,
  publish_blocked_by: 'not_tested',
  status: null,
}

/** The answers every card's page needs to reach its loaded header; one variety, 24K Gold. */
function api(archived: boolean) {
  const variety = { id: 1, name: '24K Gold', archived, removal: 'archive', current_price: archived ? null : PRICE }
  const answers = new Map<string, unknown>()
  const get = (url: string, body: unknown) => answers.set(url, body)
  get('/varieties/1', variety)
  get('/varieties', archived ? [] : [variety])
  get('/varieties?archived=true', archived ? [variety] : [])
  get('/varieties/1/prices', [PRICE])
  get('/stock', { total: 30, varieties: [], entries: [ENTRY] })
  get('/stock?archived=true', { total: 30, varieties: [], entries: [ENTRY] })
  get('/stock/varieties/1/movements', [{ ...ENTRY, kind: 'entry' }])
  get('/stock/withdrawals/1', withdrawal)
  get('/catalog', CATALOG)
  get('/pinned-catalog', PINNED)
  get('/pricing-settings', { is_bulk_pricing: true, is_vip_customers: true })
  get('/sales/1', sale)
  get('/customers/1', customer)
  get('/customers/1/account', account)
  get('/customers', [customer])
  get('/payments/debtors', { total: 0, rows: [] })
  return (input: string | URL | Request): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString()
    const found = answers.get(url) ?? (url.startsWith('/customers?') ? [customer] : undefined)
    return Promise.resolve(found === undefined ? json({}, 404) : json(found))
  }
}

interface Options {
  computer?: boolean
  archived?: boolean
  /** The history, the last entry current; the default is the screen alone. */
  entries?: (string | { pathname: string; state: unknown })[]
}

function mount(id: ScreenId, options: Options = {}) {
  viewport.current = options.computer === true ? 'computer' : 'phone'
  vi.stubGlobal('fetch', vi.fn(api(options.archived === true)))
  const entry = SCREENS.find((screenEntry) => screenEntry.id === id)
  if (entry === undefined) throw new Error(`no screen ${id}`)
  const shell = shellRoute(appRouter.routes)
  if (shell === undefined) throw new Error('router.tsx has no Shell route')
  const memory = createMemoryRouter(
    [
      {
        element: (
          <FlashProvider>
            <Outlet context={ME} />
          </FlashProvider>
        ),
        children: [{ element: <Shell />, children: shell.children }],
      },
    ],
    { initialEntries: options.entries ?? [pathTo(entry.path, { id: 1 })], initialIndex: (options.entries?.length ?? 1) - 1 },
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <SheetRouterProvider router={memory}>
        <RouterProvider router={memory} />
      </SheetRouterProvider>
    </QueryClientProvider>,
  )
  return memory
}

/** The back controls on screen: buttons or links named "‹ …" or the bare "Volver". */
function backControls(): string[] {
  return [...screen.queryAllByRole('button'), ...screen.queryAllByRole('link')]
    .map((node) => node.getAttribute('aria-label') ?? node.textContent ?? '')
    .filter((name) => name.startsWith('‹') || name === 'Volver')
}

function nuevaVentaLinks(): HTMLElement[] {
  return screen.queryAllByRole('link', { name: /^\+?\s*Nueva venta$/ })
}

/** What each card's page shows once loaded: its header and data are on screen. */
const LOADED: Record<string, () => Promise<unknown>> = {
  sale: () => screen.findByText(/^Venta del 14\/09/),
  customer: () => screen.findAllByText('Ana Pérez'),
  variety: () => screen.findByRole('heading', { name: '24K Gold' }),
  'variety-prices': () => screen.findAllByText(/^Rige desde/),
  'variety-entries': () => screen.findByRole('heading', { name: 'Entradas' }),
  catalog: () => screen.findByText('Sir Jack'),
  stock: () => screen.findByRole('heading', { name: 'Todas las entradas' }),
  'varieties-archived': () => screen.findAllByText('24K Gold'),
  withdrawal: () => screen.findByText('Zkittlez'),
  settings: () => screen.findByRole('heading', { name: 'Configuración' }),
}

/** The one arrow each card reads, on the phone and on a computer (the same unless said). */
const ARROW: Record<string, { phone: string; computer: string }> = {
  sale: { phone: '‹ Ventas', computer: '‹ Ventas' },
  customer: { phone: '‹ Clientes', computer: '' },
  variety: { phone: '‹ Variedades', computer: '' },
  'variety-prices': { phone: '‹ 24K Gold', computer: '‹ 24K Gold' },
  'variety-entries': { phone: '‹ 24K Gold', computer: '‹ 24K Gold' },
  catalog: { phone: '‹ Variedades', computer: '‹ Variedades' },
  stock: { phone: '‹ Variedades', computer: '‹ Variedades' },
  'varieties-archived': { phone: '‹ Variedades', computer: '‹ Variedades' },
  withdrawal: { phone: '‹ Variedades', computer: '‹ Variedades' },
  settings: { phone: '‹ Más', computer: '‹ Inicio' },
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const CARDS = SCREENS.filter((entry) => entry.kind === 'card').map((entry) => entry.id)
const TWO_PANE_DETAILS: ScreenId[] = ['customer', 'variety']

test('every registered card has a loaded-page check and an expected arrow', () => {
  expect([...CARDS].sort()).toEqual(Object.keys(LOADED).sort())
  expect([...CARDS].sort()).toEqual(Object.keys(ARROW).sort())
})

test('the "+ Nueva venta" query finds the control on a tab root', async () => {
  mount('home')

  await waitFor(() => expect(nuevaVentaLinks().length).toBeGreaterThan(0))
})

test.each(CARDS)('on the phone, %s shows exactly one back control, the one the registry names, and no "+ Nueva venta"', async (id) => {
  mount(id, { archived: id === 'varieties-archived' })

  await LOADED[id]?.()
  expect(backControls()).toEqual([ARROW[id]?.phone])
  expect(nuevaVentaLinks()).toHaveLength(0)
})

test.each(CARDS.filter((id) => !TWO_PANE_DETAILS.includes(id)))(
  'on a computer, %s shows exactly one back control and no "+ Nueva venta"',
  async (id) => {
    mount(id, { computer: true, archived: id === 'varieties-archived' })

    await LOADED[id]?.()
    await waitFor(() => expect(backControls()).toEqual([ARROW[id]?.computer]))
    expect(nuevaVentaLinks()).toHaveLength(0)
  },
)

test.each(TWO_PANE_DETAILS)(
  'on a computer, %s adds no back control of its own and its host keeps the sidebar "+ Nueva venta"',
  async (id) => {
    mount(id, { computer: true })

    await LOADED[id]?.()
    expect(backControls()).toEqual([])
    expect(nuevaVentaLinks().length).toBeGreaterThan(0)
  },
)

test('an archived variety on the phone reads "‹ Archivadas", once', async () => {
  mount('variety', { archived: true })

  await screen.findByRole('heading', { name: '24K Gold' })
  await waitFor(() => expect(backControls()).toEqual(['‹ Archivadas']))
})

test('the "Ver todas" lists of a variety read "‹ <variety>", once each', async () => {
  mount('variety-entries')
  await LOADED['variety-entries']?.()
  await waitFor(() => expect(backControls()).toEqual(['‹ 24K Gold']))
})

const HISTORY: { id: ScreenId; path: string; from: string; parent: string }[] = [
  { id: 'variety-prices', path: pathTo(VARIETY_PRICES, { id: 1 }), from: pathTo(VARIETY, { id: 1 }), parent: pathTo(VARIETY, { id: 1 }) },
  { id: 'variety-entries', path: pathTo(VARIETY_ENTRIES, { id: 1 }), from: pathTo(VARIETY, { id: 1 }), parent: pathTo(VARIETY, { id: 1 }) },
  { id: 'stock', path: STOCK, from: VARIETIES, parent: VARIETIES },
  { id: 'withdrawal', path: pathTo(WITHDRAWAL, { id: 1 }), from: VARIETIES, parent: VARIETIES },
]

test.each(HISTORY)('$id: the arrow goes back by history when the entry is in-app', async ({ id, path, from }) => {
  const memory = mount(id, { entries: [from, { pathname: path, state: inAppState({ pathname: from }) }] })

  await LOADED[id]?.()
  await userEvent.click(screen.getByRole('button', { name: /^‹/ }))

  await waitFor(() => expect(memory.state.location.pathname).toBe(from))
  expect(memory.state.historyAction).toBe('POP')
})

test.each(HISTORY)('$id: with no history the arrow goes to its parent', async ({ id, path, parent }) => {
  const memory = mount(id, { entries: [path] })

  await LOADED[id]?.()
  await userEvent.click(screen.getByRole('button', { name: /^‹/ }))

  await waitFor(() => expect(memory.state.location.pathname).toBe(parent))
})
