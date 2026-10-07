/**
 * `EntriesList` at the screen seam (`stock.md`, "Todas las entradas"): every entry newest
 * first, or only one variety's through `entriesOf`; each can be edited (a link to its
 * form) or deleted after "Antes de borrar". The API is faked at `fetch`.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router'
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
  pathTo,
} from '../routes'
import EntriesList from './EntriesList'
import VarietyRoute from './varieties/VarietyRoute'

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
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        <FlashProvider>
          <Routes>
            <Route element={<Provide />}>
              <Route path={VARIETIES_PATH} element={<Where opens={opens} />} />
              <Route path={STOCK_PATH} element={<EntriesList />} />
              <Route path={STOCK_ENTRY} element={<Where />} />
              <Route path={VARIETY_ENTRIES} element={<VarietyRoute render={(varietyId) => <EntriesList varietyId={varietyId} />} />} />
              <Route path={VARIETY} element={<Where />} />
            </Route>
          </Routes>
        </FlashProvider>
      </MemoryRouter>
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

/** Opens a list the way the seller does, from Variedades by a link, so the entry carries the in-app state. */
async function openFromVariedades(path: string) {
  fakeApi()
  renderAt(VARIETIES_PATH, undefined, { entries: [VARIETIES_PATH], opens: path })
  await userEvent.click(await screen.findByRole('link', { name: 'Abrir' }))
}

test("a variety's list goes back by history to where the seller came from", async () => {
  await openFromVariedades(pathTo(VARIETY_ENTRIES, { id: 3 }))

  await userEvent.click(await screen.findByRole('button', { name: '‹ 24K Gold' }))
  expect((await screen.findByTestId('where')).textContent).toBe(VARIETIES_PATH)
})

test('"Todas las entradas" goes back by history to where the seller came from', async () => {
  await openFromVariedades(STOCK_PATH)

  await userEvent.click(await screen.findByRole('button', { name: /^‹ / }))
  expect((await screen.findByTestId('where')).textContent).toBe(VARIETIES_PATH)
})

test("a variety's list with no history goes back to the variety's page", async () => {
  fakeApi()
  renderAt(pathTo(VARIETY_ENTRIES, { id: 3 }), undefined, { entries: [pathTo(VARIETY_ENTRIES, { id: 3 })] })

  await userEvent.click(await screen.findByRole('button', { name: '‹ 24K Gold' }))
  expect((await screen.findByTestId('where')).textContent).toBe(pathTo(VARIETY, { id: 3 }))
})

test('"Todas las entradas" with no history goes back to Variedades', async () => {
  fakeApi()
  renderAt(STOCK_PATH, undefined, { entries: [STOCK_PATH] })

  await userEvent.click(await screen.findByRole('button', { name: /^‹ / }))
  expect((await screen.findByTestId('where')).textContent).toBe(VARIETIES_PATH)
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
