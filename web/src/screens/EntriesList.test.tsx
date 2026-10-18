/**
 * `EntriesList` at the screen seam (`stock.md`, "Todas las entradas"): every entry newest
 * first, or only one variety's through `entriesOf`; each can be edited (a link to its
 * form) or deleted after "Antes de borrar". The API is faked at `fetch`.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outlet, RouterProvider, createMemoryRouter, useLocation } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { catalogQueryOptions } from '../api/catalog'
import type { Me } from '../api/me'
import InAppLink from '../components/InAppLink'
import FlashProvider from '../flash/FlashProvider'
import {
  STOCK as STOCK_PATH,
  STOCK_ENTRY,
  VARIETIES as VARIETIES_PATH,
  VARIETY,
  VARIETY_ENTRIES,
  WITHDRAWAL,
  pathTo,
} from '../routes'
import EntriesList from './EntriesList'
import VarietyRoute from './varieties/VarietyRoute'
import { LIMITS } from '../copy/limits'
import { expectIconAndTextRule } from '../test/iconAndTextRule'
import Shell from '../shell/Shell'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-06' }

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const VARIETIES = [
  { id: 3, name: '24K Gold', current_price: null },
  { id: 4, name: 'Sir Jack', current_price: null },
]

function entry(id: number, date: string, varietyId: number, grams: number, total: number | null) {
  return {
    id,
    date,
    variety_id: varietyId,
    origin: total === null ? 'harvest' : 'purchase',
    grams,
    total_cost: total,
    cost_per_gram: total === null ? null : total / grams,
    note: null,
  }
}

const STOCK = {
  total: 70,
  varieties: [],
  entries: [
    entry(12, '2026-10-05', 3, 30, 150000),
    entry(11, '2026-08-26', 4, 10, null),
    entry(10, '2026-08-20', 3, 40, 200000),
  ],
}

function Provide() {
  return <Outlet context={ME} />
}

function Where({ opens }: { opens?: string }) {
  const location = useLocation()
  return (
    <div>
      <span data-testid="where">{location.pathname}</span>
      {opens !== undefined && <InAppLink to={opens}>Abrir</InAppLink>}
    </div>
  )
}

function fakeApi(overrides: Record<string, () => Response> = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = init?.method ?? 'GET'
      const key = `${method} ${url}`
      const override = overrides[key]
      if (override !== undefined) return Promise.resolve(override())
      if (key === 'GET /stock') return Promise.resolve(jsonResponse(200, STOCK))
      if (key === 'GET /varieties') return Promise.resolve(jsonResponse(200, VARIETIES))
      const movements = /^GET \/stock\/varieties\/(\d+)\/movements$/.exec(key)
      if (movements !== null) {
        const own = STOCK.entries.filter((row) => String(row.variety_id) === movements[1])
        return Promise.resolve(jsonResponse(200, own.map((row) => ({ ...row, kind: 'entry' }))))
      }
      const one = /^GET \/varieties\/(\d+)$/.exec(key)
      if (one !== null) {
        const found = VARIETIES.find((variety) => String(variety.id) === one[1])
        return Promise.resolve(
          found === undefined
            ? jsonResponse(404, { code: 'variety.not_found', detail: 'x' })
            : jsonResponse(200, found),
        )
      }
      return Promise.resolve(jsonResponse(500, {}))
    }),
  )
}

/** `entries` is the history, the last one current; `opens` is the link Variedades offers. */
function renderAt(
  path: string,
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  { entries = [VARIETIES_PATH, path], opens }: { entries?: string[]; opens?: string } = {},
) {
  const router = createMemoryRouter(
    [
      {
        element: (
          <FlashProvider>
            <Provide />
          </FlashProvider>
        ),
        children: [
          {
            element: <Shell />,
            children: [
              { path: VARIETIES_PATH, element: <Where opens={opens} />, handle: { screen: 'varieties' } },
              { path: STOCK_PATH, element: <EntriesList />, handle: { screen: 'stock' } },
              { path: STOCK_ENTRY, element: <Where />, handle: { screen: 'stock-entry' } },
              {
                path: VARIETY_ENTRIES,
                element: <VarietyRoute render={(varietyId) => <EntriesList varietyId={varietyId} />} />,
                handle: { screen: 'variety-entries' },
              },
              { path: VARIETY, element: <Where />, handle: { screen: 'variety' } },
            ],
          },
        ],
      },
    ],
    { initialEntries: entries, initialIndex: entries.length - 1 },
  )
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return client
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('"Todas las entradas" lists every entry newest first with its variety, origin, grams and costs', async () => {
  fakeApi()
  renderAt(STOCK_PATH)

  const rows = await screen.findAllByRole('listitem')
  expect(rows).toHaveLength(3)
  expect(within(rows[0]!).getByText('05/10 · 24K Gold')).toBeInTheDocument()
  expect(within(rows[0]!).getByText('Compra · 30 g')).toBeInTheDocument()
  expect(within(rows[0]!).getByText('$ 150.000')).toBeInTheDocument()
  expect(within(rows[0]!).getByText('$ 5.000 x g')).toBeInTheDocument()
  expect(within(rows[1]!).getByText('26/08 · Sir Jack')).toBeInTheDocument()
  expect(within(rows[1]!).getByText('Cosecha · 10 g')).toBeInTheDocument()
  expect(within(rows[1]!).getByText('Sin costo')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Todas las entradas' })).toBeInTheDocument()
})

test("a variety's list shows only its entries", async () => {
  fakeApi()
  renderAt(pathTo(VARIETY_ENTRIES, { id: 3 }))

  const rows = await screen.findAllByRole('listitem')
  expect(rows).toHaveLength(2)
  expect(screen.queryByText('26/08 · Sir Jack')).not.toBeInTheDocument()
})

const ARCHIVED_VARIETY = { id: 3, name: '24K Gold', current_price: null, archived: true }

test("an archived variety's list is read-only: entry rows have no edit, no delete and open nothing", async () => {
  fakeApi({ 'GET /varieties/3': () => jsonResponse(200, ARCHIVED_VARIETY) })
  renderAt(pathTo(VARIETY_ENTRIES, { id: 3 }))

  const rows = await screen.findAllByRole('listitem')
  expect(rows).toHaveLength(2)
  expect(within(rows[0]!).getByText('05/10 · 24K Gold')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Borrar' })).toBeNull()
  expect(screen.queryByRole('link', { name: 'Editar' })).toBeNull()
  expect(within(screen.getByRole('list')).queryAllByRole('link')).toHaveLength(0)
})

test("an archived variety's withdrawal rows still open the withdrawal's detail", async () => {
  fakeApi({
    'GET /varieties/3': () => jsonResponse(200, ARCHIVED_VARIETY),
    'GET /stock/varieties/3/movements': () =>
      jsonResponse(200, [
        { kind: 'withdrawal', id: 9, date: '2026-10-06', reason: 'promotion', grams: 5.5 },
        { ...STOCK.entries[0], kind: 'entry' },
      ]),
  })
  renderAt(pathTo(VARIETY_ENTRIES, { id: 3 }))

  const rows = await screen.findAllByRole('listitem')
  expect(within(rows[0]!).getByRole('link')).toHaveAttribute('href', pathTo(WITHDRAWAL, { id: 9 }))
  expect(within(rows[1]!).queryByRole('link')).toBeNull()
  expect(within(rows[1]!).queryByRole('button', { name: 'Borrar' })).toBeNull()
})

test("a variety's list holds its withdrawals, told by reason word and minus sign, each opening its detail", async () => {
  fakeApi({
    'GET /stock/varieties/3/movements': () =>
      jsonResponse(200, [
        { kind: 'withdrawal', id: 9, date: '2026-10-06', reason: 'promotion', grams: 5.5 },
        { ...STOCK.entries[0], kind: 'entry' },
      ]),
  })
  renderAt(pathTo(VARIETY_ENTRIES, { id: 3 }))

  const rows = await screen.findAllByRole('listitem')
  expect(rows).toHaveLength(2)
  expect(within(rows[0]!).getByText('Promoción · −5,5 g')).toBeInTheDocument()
  expect(within(rows[0]!).getByRole('link')).toHaveAttribute('href', pathTo(WITHDRAWAL, { id: 9 }))
  expect(within(rows[0]!).queryByRole('button', { name: 'Borrar' })).not.toBeInTheDocument()
  expect(within(rows[1]!).getByText('Compra · 30 g')).toBeInTheDocument()
})

/**
 * "Todas las entradas" renders what `GET /stock` answers and never reaches for the movements
 * that carry withdrawals; that `GET /stock` itself holds no withdrawal is pinned by
 * `test_the_business_wide_entries_list_holds_no_withdrawal`.
 */
test('"Todas las entradas" shows the entry and no withdrawal, and never asks for movements', async () => {
  const recorded = entry(12, '2026-10-05', 3, 30, 150000)
  fakeApi({
    'GET /stock': () => jsonResponse(200, { total: 30, varieties: [], entries: [recorded] }),
    'GET /stock/varieties/3/movements': () =>
      jsonResponse(200, [
        { kind: 'withdrawal', id: 9, date: '2026-10-06', reason: 'promotion', grams: 5.5 },
        { ...recorded, kind: 'entry' },
      ]),
  })
  renderAt(STOCK_PATH)

  const rows = await screen.findAllByRole('listitem')
  expect(within(rows[0]!).getByText('05/10 · 24K Gold')).toBeInTheDocument()
  expect(within(rows[0]!).getByText('Compra · 30 g')).toBeInTheDocument()
  expect(rows).toHaveLength(1)

  const asked = vi.mocked(fetch).mock.calls.map(([url]) => String(url))
  expect(asked.filter((url) => url.includes('/movements'))).toEqual([])

  const list = screen.getByRole('list')
  expect(within(list).queryByText(/Promoción|Consumo propio/)).toBeNull()
  expect(within(list).queryByText(/−/)).toBeNull()
})

test('Editar links to the entry form', async () => {
  fakeApi()
  renderAt(STOCK_PATH)

  const rows = await screen.findAllByRole('listitem')
  await userEvent.click(within(rows[1]!).getByRole('link', { name: 'Editar' }))
  expect(await screen.findByTestId('where')).toHaveTextContent(pathTo(STOCK_ENTRY, { id: 11 }))
})

test('Borrar asks "Antes de borrar" naming date, variety and grams, then deletes and says so', async () => {
  fakeApi({ 'DELETE /stock/entries/12': () => new Response(null, { status: 204 }) })
  renderAt(STOCK_PATH)

  const rows = await screen.findAllByRole('listitem')
  await userEvent.click(within(rows[0]!).getByRole('button', { name: 'Borrar' }))
  const dialog = await screen.findByRole('alertdialog', { name: 'Antes de borrar' })
  expect(dialog).toHaveTextContent('¿Borrás la entrada del 05/10 de 24K Gold, 30 g?')

  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrala' }))
  expect(await screen.findByText('Entrada eliminada')).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/stock/entries/12', expect.objectContaining({ method: 'DELETE' }))
})

test('declining "Antes de borrar" deletes nothing', async () => {
  fakeApi()
  renderAt(STOCK_PATH)

  const rows = await screen.findAllByRole('listitem')
  await userEvent.click(within(rows[0]!).getByRole('button', { name: 'Borrar' }))
  await userEvent.click(await screen.findByRole('button', { name: 'No, dejala' }))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining('/stock/entries'), expect.anything())
})

test('deleting an entry that is already gone says so and refreshes the list', async () => {
  fakeApi({
    'DELETE /stock/entries/12': () =>
      jsonResponse(404, { code: 'stock.entry_not_found', detail: 'x' }),
  })
  renderAt(STOCK_PATH)

  const rows = await screen.findAllByRole('listitem')
  await userEvent.click(within(rows[0]!).getByRole('button', { name: 'Borrar' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Sí, borrala' }))
  expect(await screen.findByText('Eso ya no está. La lista ya está al día.')).toBeInTheDocument()
  expect(screen.queryByText('Entrada eliminada')).not.toBeInTheDocument()
})

test('with no entries the empty state shows, with no rows', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/stock') return Promise.resolve(jsonResponse(200, { total: 0, varieties: [], entries: [] }))
      return Promise.resolve(jsonResponse(200, VARIETIES))
    }),
  )
  renderAt(STOCK_PATH)

  expect(await screen.findByText('Sin entradas de stock')).toBeInTheDocument()
  expect(screen.getByText('Cargá tu stock inicial o una compra')).toBeInTheDocument()
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
})

test('a variety that is gone, or an id that is not a number, shows "Eso ya no está."', async () => {
  fakeApi()
  renderAt(pathTo(VARIETY_ENTRIES, { id: 99 }))
  expect(await screen.findByText('Eso ya no está.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Volver a Variedades' })).toBeInTheDocument()
})

test('a delete marks the catalog stale and the stock list refetches', async () => {
  fakeApi({ 'DELETE /stock/entries/12': () => new Response(null, { status: 204 }) })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(catalogQueryOptions().queryKey, { text: null, header: '', footer: '', varieties: [] })
  renderAt(STOCK_PATH, client)

  const rows = await screen.findAllByRole('listitem')
  await userEvent.click(within(rows[0]!).getByRole('button', { name: 'Borrar' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Sí, borrala' }))
  await screen.findByText('Entrada eliminada')
  const stockCalls = vi.mocked(fetch).mock.calls.filter(([url]) => url === '/stock')
  expect(stockCalls.length).toBeGreaterThanOrEqual(2)
  expect(client.getQueryState(catalogQueryOptions().queryKey)?.isInvalidated).toBe(true)
})

test('the list keeps the icon and text rule: Borrar is the icon-only control with its word as name', async () => {
  fakeApi()
  renderAt(STOCK_PATH)

  const rows = await screen.findAllByRole('listitem')
  const borrar = within(rows[0]!).getByRole('button', { name: 'Borrar' })
  expect(borrar).toHaveClass('boton-icono')
  expect(borrar).toHaveTextContent('')
  expect(borrar.querySelector('svg')).not.toBeNull()
  expectIconAndTextRule(screen.getByRole('main'), { limits: LIMITS })
})

test('the empty state keeps the title and the line within their limits', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/stock') return Promise.resolve(jsonResponse(200, { total: 0, varieties: [], entries: [] }))
      return Promise.resolve(jsonResponse(200, VARIETIES))
    }),
  )
  renderAt(STOCK_PATH)

  await screen.findByText('Sin entradas de stock')
  expect(document.querySelectorAll('[data-copy="emptyTitle"], [data-copy="emptyLine"]')).toHaveLength(2)
  expectIconAndTextRule(screen.getByRole('main'), { limits: LIMITS })
})
