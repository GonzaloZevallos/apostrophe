/**
 * `EntradaStock` at the screen seam (`stock.md`, "New entry" and "Editing an
 * entry"): records a new entry (with today filled in and "Hoy tiene N g" under the
 * variety), lets an adjustment carry negative grams, refuses a purchase with no cost
 * on its own field, confirms before saving an edit, and confirms before deleting,
 * naming the date, variety and grams.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { createMemoryRouter, Outlet, RouterProvider, useLocation } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { catalogQueryOptions } from '../api/catalog'
import type { Me } from '../api/me'
import { SHOWN_EN } from '../test/shownLanguage'
import { GONE_NOTICE } from '../api/refusals'
import { useGoneNotice } from '../components/goneExit'
import InAppLink from '../components/InAppLink'
import { inAppState } from '../components/inAppState'
import { SheetRouterProvider } from '../components/useSheetStack'
import { stubViewport } from '../test-viewport'
import FlashProvider from '../flash/FlashProvider'
import { STOCK, STOCK_ENTRY, STOCK_ENTRY_NEW, VARIETIES as VARIETIES_PATH, VARIETY, pathTo } from '../routes'
import EntradaStock from './EntradaStock'
import { LIMITS } from '../copy/limits'
import { expectIconAndTextRule } from '../test/iconAndTextRule'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03', shown_language: SHOWN_EN }

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function Where({ label, opens }: { label: string; opens?: string }) {
  const location = useLocation()
  const goneShown = useGoneNotice()
  return (
    <div>
      <span>{label}</span>
      <span data-testid="where">{location.pathname}</span>
      {opens !== undefined && <InAppLink to={opens}>Abrir la entrada</InAppLink>}
      {goneShown && <span role="status">{GONE_NOTICE}</span>}
    </div>
  )
}

/** Opens the new-entry form from the variety's page, by its link, so the entry carries the in-app state. */
async function renderFromVariety() {
  renderForm(pathTo(VARIETY, { id: 3 }))
  await userEvent.click(await screen.findByRole('link', { name: 'Abrir la entrada' }))
}

function Provide() {
  return (
    <FlashProvider>
      <Outlet context={ME} />
    </FlashProvider>
  )
}

const ROUTES = [
  {
    element: <Provide />,
    children: [
      { path: STOCK_ENTRY_NEW, element: <EntradaStock mode="nuevo" /> },
      { path: STOCK_ENTRY, element: <EntradaStock mode="editar" /> },
      { path: STOCK, element: <Where label="todas las entradas" /> },
      {
        path: VARIETY,
        element: <Where label="la página de la variety" opens={`${STOCK_ENTRY_NEW}?variety=3`} />,
      },
      { path: VARIETIES_PATH, element: <Where label="la lista de varieties" /> },
    ],
  },
]

function renderForm(
  initialPath: string | string[],
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  const entries = typeof initialPath === 'string' ? [initialPath] : initialPath
  const router = createMemoryRouter(ROUTES, { initialEntries: entries, initialIndex: entries.length - 1 })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return client
}

type HistoryEntry = string | { pathname: string; state: unknown }

/** The real data router under StrictMode and the router handle the gone notice follows. */
function renderGone(entries: HistoryEntry[], index = entries.length - 1) {
  const router = createMemoryRouter(ROUTES, { initialEntries: entries, initialIndex: index })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const app = (
    <StrictMode>
      <QueryClientProvider client={client}>
        <SheetRouterProvider router={router}>
          <RouterProvider router={router} />
        </SheetRouterProvider>
      </QueryClientProvider>
    </StrictMode>
  )
  const view = render(app)
  return { router, view, app }
}

const VARIETIES = [{ id: 3, name: 'Sir Jack', current_price: null }]
const STOCK_VIEW = {
  total: 18.5,
  varieties: [
    {
      variety_id: 3,
      grams: 18.5,
      status: 'ok',
      sold_out_since: null,
      threshold: null,
      days_left: 10,
    },
  ],
  entries: [],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('a new entry starts dated today and shows "Hoy tiene N g" once a variety is picked', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/varieties') return Promise.resolve(jsonResponse(200, VARIETIES))
      if (url === '/stock') return Promise.resolve(jsonResponse(200, STOCK_VIEW))
      return Promise.resolve(jsonResponse(500, {}))
    }),
  )
  renderForm(STOCK_ENTRY_NEW)

  expect(screen.getByLabelText('Date')).toHaveValue('2026-10-03')

  await screen.findByRole('option', { name: 'Sir Jack' })
  await userEvent.selectOptions(screen.getByLabelText('Variety'), 'Sir Jack')

  expect(await screen.findByText('It has 18,5 g today')).toBeInTheDocument()
})

test('records an entry and lands back on the list with the saved toast', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/varieties') return Promise.resolve(jsonResponse(200, VARIETIES))
      if (url === '/stock') return Promise.resolve(jsonResponse(200, STOCK_VIEW))
      return Promise.resolve(
        jsonResponse(201, {
          id: 10,
          date: '2026-10-03',
          variety_id: 3,
          origin: 'harvest',
          grams: 30,
          total_cost: null,
          cost_per_gram: null,
          note: null,
        }),
      )
    }),
  )
  renderForm(STOCK_ENTRY_NEW)

  await userEvent.type(screen.getByLabelText('Grams'), '30')
  await userEvent.selectOptions(await screen.findByLabelText('Variety'), 'Sir Jack')
  await userEvent.click(screen.getByRole('button', { name: 'Save the entry' }))

  expect(await screen.findByText('la lista de varieties')).toBeInTheDocument()
  expect(await screen.findByText('Entry saved')).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/stock/entries', expect.objectContaining({ method: 'POST' }))
})

test('an adjustment can carry negative grams, sent through to the API as typed', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/varieties') return Promise.resolve(jsonResponse(200, VARIETIES))
      if (url === '/stock') return Promise.resolve(jsonResponse(200, STOCK_VIEW))
      expect(init?.body).toEqual(expect.stringContaining('"-4.5"'))
      return Promise.resolve(
        jsonResponse(201, {
          id: 11,
          date: '2026-10-03',
          variety_id: 3,
          origin: 'adjustment',
          grams: -4.5,
          total_cost: null,
          cost_per_gram: null,
          note: null,
        }),
      )
    }),
  )
  renderForm(STOCK_ENTRY_NEW)

  await userEvent.type(screen.getByLabelText('Grams'), '-4,5')
  await userEvent.selectOptions(await screen.findByLabelText('Variety'), 'Sir Jack')
  await userEvent.click(screen.getByRole('button', { name: 'Adjustment' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save the entry' }))

  expect(await screen.findByText('la lista de varieties')).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/stock/entries', expect.objectContaining({ method: 'POST' }))
})

test('re-saving an existing negative adjustment keeps its negative grams through PUT', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/varieties') return Promise.resolve(jsonResponse(200, VARIETIES))
      if (url === '/stock') return Promise.resolve(jsonResponse(200, STOCK_VIEW))
      if (init?.method === 'GET') {
        return Promise.resolve(
          jsonResponse(200, {
            id: 12,
            date: '2026-09-15',
            variety_id: 3,
            origin: 'adjustment',
            grams: -4.5,
            total_cost: null,
            cost_per_gram: null,
            note: null,
          }),
        )
      }
      expect(init?.body).toEqual(expect.stringContaining('"-4.5"'))
      return Promise.resolve(
        jsonResponse(200, {
          id: 12,
          date: '2026-09-15',
          variety_id: 3,
          origin: 'adjustment',
          grams: -4.5,
          total_cost: null,
          cost_per_gram: null,
          note: null,
        }),
      )
    }),
  )
  renderForm(pathTo(STOCK_ENTRY, { id: 12 }))

  expect(await screen.findByLabelText('Grams')).toHaveValue('-4.5')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Yes, save' }))

  expect(await screen.findByText('todas las entradas')).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/stock/entries/12', expect.objectContaining({ method: 'PUT' }))
})

test('a purchase refused for missing cost shows the refusal on its own field, keeping what was typed', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/varieties') return Promise.resolve(jsonResponse(200, VARIETIES))
      if (url === '/stock') return Promise.resolve(jsonResponse(200, STOCK_VIEW))
      return Promise.resolve(jsonResponse(422, { detail: 'needs a cost', code: 'stock.cost_required' }))
    }),
  )
  renderForm(STOCK_ENTRY_NEW)

  await userEvent.type(screen.getByLabelText('Grams'), '30')
  await userEvent.selectOptions(await screen.findByLabelText('Variety'), 'Sir Jack')
  await userEvent.click(screen.getByRole('button', { name: 'Save the entry' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('A purchase needs a total cost')
  expect(screen.getByLabelText('Grams')).toHaveValue('30')
})

test('editing an entry confirms before saving', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/varieties') return Promise.resolve(jsonResponse(200, VARIETIES))
      if (url === '/stock') return Promise.resolve(jsonResponse(200, STOCK_VIEW))
      if (url === '/stock/entries/10') {
        return Promise.resolve(
          jsonResponse(200, {
            id: 10,
            date: '2026-09-20',
            variety_id: 3,
            origin: 'harvest',
            grams: 25,
            total_cost: null,
            cost_per_gram: null,
            note: null,
          }),
        )
      }
      return Promise.resolve(
        jsonResponse(200, {
          id: 10,
          date: '2026-09-20',
          variety_id: 3,
          origin: 'harvest',
          grams: 28,
          total_cost: null,
          cost_per_gram: null,
          note: null,
        }),
      )
    }),
  )
  renderForm(pathTo(STOCK_ENTRY, { id: 10 }))

  expect(await screen.findByLabelText('Grams')).toHaveValue('25')
  await userEvent.clear(screen.getByLabelText('Grams'))
  await userEvent.type(screen.getByLabelText('Grams'), '28')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByRole('alertdialog')).toHaveTextContent('Save the changes?')
  expect(fetch).not.toHaveBeenCalledWith('/stock/entries/10', expect.objectContaining({ method: 'PUT' }))

  await userEvent.click(screen.getByRole('button', { name: 'Yes, save' }))

  expect(await screen.findByText('todas las entradas')).toBeInTheDocument()
  expect(await screen.findByText('Entry saved')).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/stock/entries/10', expect.objectContaining({ method: 'PUT' }))
})

test('deleting an entry confirms first, naming the date, variety and grams', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/varieties') return Promise.resolve(jsonResponse(200, VARIETIES))
      if (url === '/stock') return Promise.resolve(jsonResponse(200, STOCK_VIEW))
      if (url === '/stock/entries/10') {
        return Promise.resolve(
          jsonResponse(200, {
            id: 10,
            date: '2026-09-20',
            variety_id: 3,
            origin: 'harvest',
            grams: 25,
            total_cost: null,
            cost_per_gram: null,
            note: null,
          }),
        )
      }
      return Promise.resolve(new Response(null, { status: 204 }))
    }),
  )
  renderForm(pathTo(STOCK_ENTRY, { id: 10 }))

  await userEvent.click(await screen.findByRole('button', { name: 'Delete entry' }))

  const dialog = await screen.findByRole('alertdialog')
  expect(dialog).toHaveTextContent('20/09')
  expect(dialog).toHaveTextContent('Sir Jack')
  expect(dialog).toHaveTextContent('25 g')

  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }))

  expect(await screen.findByText('todas las entradas')).toBeInTheDocument()
  expect(await screen.findByText('Entry deleted')).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/stock/entries/10', expect.objectContaining({ method: 'DELETE' }))
})

test('deleting an entry never re-fetches the entry it just deleted', async () => {
  // Enforcement seam: `invalidateResource(queryClient, 'stock')` refreshes every
  // `'stock'`-prefixed query, including this very screen's own `stockEntry(10)`
  // query — still mounted the instant delete succeeds, a heartbeat before
  // `navigate` unmounts it. A plain invalidate (not `invalidateStockAfterDeleting`)
  // would mark that query active again and the still-subscribed `useQuery` would
  // issue a second `GET /stock/entries/10` for an entry that no longer exists —
  // real browsers log that as a 404 (caught by the e2e run's "zero console
  // messages" assertion). This input — a delete that succeeds while the entry's
  // own query is still live — is exactly what a bare `invalidateResource` call
  // must be rejected in favour of.
  let getEntryCalls = 0
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/varieties') return Promise.resolve(jsonResponse(200, VARIETIES))
      if (url === '/stock') return Promise.resolve(jsonResponse(200, STOCK_VIEW))
      if (url === '/stock/entries/10' && init?.method === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }))
      }
      if (url === '/stock/entries/10') {
        getEntryCalls += 1
        return Promise.resolve(
          jsonResponse(200, {
            id: 10,
            date: '2026-09-20',
            variety_id: 3,
            origin: 'harvest',
            grams: 25,
            total_cost: null,
            cost_per_gram: null,
            note: null,
          }),
        )
      }
      return Promise.resolve(new Response(null, { status: 404 }))
    }),
  )
  renderForm(pathTo(STOCK_ENTRY, { id: 10 }))

  await userEvent.click(await screen.findByRole('button', { name: 'Delete entry' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Yes, delete it' }))

  expect(await screen.findByText('todas las entradas')).toBeInTheDocument()
  expect(getEntryCalls).toBe(1)
})

function stockOf(entries: { id: number; variety_id: number }[]) {
  return {
    ...STOCK_VIEW,
    entries: entries.map((row) => ({
      ...row,
      date: '2026-09-01',
      origin: 'harvest',
      grams: 10,
      total_cost: null,
      cost_per_gram: null,
      note: null,
    })),
  }
}

function fakeFor(stock: unknown, extra: Record<string, () => Response> = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const key = `${init?.method ?? 'GET'} ${url}`
      const hit = extra[key]
      if (hit !== undefined) return Promise.resolve(hit())
      if (url === '/varieties') return Promise.resolve(jsonResponse(200, VARIETIES))
      if (url === '/stock') return Promise.resolve(jsonResponse(200, stock))
      return Promise.resolve(jsonResponse(500, {}))
    }),
  )
}

test('an entry started from a variety has it chosen and "Initial stock" preselected when it has no entries', async () => {
  fakeFor(stockOf([]))
  renderForm(`${STOCK_ENTRY_NEW}?variety=3`)

  const select = await screen.findByRole('combobox', { name: /^Variety/ })
  await waitFor(() => expect(select).toHaveValue('3'))
  expect(screen.getByRole('group', { name: 'Origin' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Initial stock' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Purchase' })).toHaveAttribute('aria-pressed', 'false')
})

test('an entry started from a variety that already has entries keeps Compra', async () => {
  fakeFor(stockOf([{ id: 1, variety_id: 3 }]))
  renderForm(`${STOCK_ENTRY_NEW}?variety=3`)

  const select = await screen.findByRole('combobox', { name: /^Variety/ })
  await waitFor(() => expect(select).toHaveValue('3'))
  expect(screen.getByRole('button', { name: 'Purchase' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Initial stock' })).toHaveAttribute('aria-pressed', 'false')
})

test("another variety's entries do not stop 'Initial stock' from being preselected", async () => {
  fakeFor(stockOf([{ id: 1, variety_id: 9 }]))
  renderForm(`${STOCK_ENTRY_NEW}?variety=3`)

  const select = await screen.findByRole('combobox', { name: /^Variety/ })
  await waitFor(() => expect(select).toHaveValue('3'))
  expect(screen.getByRole('button', { name: 'Initial stock' })).toHaveAttribute('aria-pressed', 'true')
})

test('from "+ Stock entry" no variety is chosen and Compra is the origin', async () => {
  fakeFor(stockOf([]))
  renderForm(STOCK_ENTRY_NEW)

  expect(await screen.findByRole('combobox', { name: /^Variety/ })).toHaveValue('')
  expect(screen.getByRole('group', { name: 'Origin' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Purchase' })).toHaveAttribute('aria-pressed', 'true')
})

test('Cerrar goes back by history to where the form was opened', async () => {
  fakeFor(stockOf([]))
  await renderFromVariety()

  await userEvent.click(await screen.findByRole('button', { name: 'Close' }))
  expect(await screen.findByText('la página de la variety')).toBeInTheDocument()
  expect(screen.getByTestId('where')).toHaveTextContent(pathTo(VARIETY, { id: 3 }))
})

test('Cerrar with no history goes to Variedades for a new entry', async () => {
  fakeFor(stockOf([]))
  renderForm(STOCK_ENTRY_NEW)
  await userEvent.click(await screen.findByRole('button', { name: 'Close' }))
  expect(await screen.findByText('la lista de varieties')).toBeInTheDocument()
})

test('Cerrar with no history goes to "All entries" for an edit', async () => {
  fakeFor(stockOf([]), {
    'GET /stock/entries/10': () =>
      jsonResponse(200, {
        id: 10,
        date: '2026-09-20',
        variety_id: 3,
        origin: 'harvest',
        grams: 25,
        total_cost: null,
        cost_per_gram: null,
        note: null,
      }),
  })
  renderForm(pathTo(STOCK_ENTRY, { id: 10 }))
  await userEvent.click(await screen.findByRole('button', { name: 'Close' }))
  expect(await screen.findByText('todas las entradas')).toBeInTheDocument()
})

test('a save goes back by history too, and says "Entry saved" there', async () => {
  fakeFor(stockOf([]), {
    'POST /stock/entries': () =>
      jsonResponse(201, {
        id: 11,
        date: '2026-10-03',
        variety_id: 3,
        origin: 'opening_stock',
        grams: 30,
        total_cost: null,
        cost_per_gram: null,
        note: null,
      }),
  })
  await renderFromVariety()

  await userEvent.type(await screen.findByLabelText('Grams'), '30')
  await userEvent.click(screen.getByRole('button', { name: 'Save the entry' }))
  expect(await screen.findByText('la página de la variety')).toBeInTheDocument()
  expect(await screen.findByText('Entry saved')).toBeInTheDocument()
})

test('a missing or foreign entry shows "That is gone." with "Back to Varieties"', async () => {
  fakeFor(stockOf([]), {
    'GET /stock/entries/99': () => jsonResponse(404, { code: 'stock.entry_not_found', detail: 'x' }),
  })
  renderForm(pathTo(STOCK_ENTRY, { id: 99 }))

  expect(await screen.findByText('That is gone.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to Varieties' })).toHaveAttribute('href', VARIETIES_PATH)
})

test('a save marks the catalog stale, since stock changes what it says', async () => {
  fakeFor(stockOf([]), {
    'POST /stock/entries': () =>
      jsonResponse(201, {
        id: 11,
        date: '2026-10-03',
        variety_id: 3,
        origin: 'harvest',
        grams: 30,
        total_cost: null,
        cost_per_gram: null,
        note: null,
      }),
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(catalogQueryOptions().queryKey, { text: null, header: '', footer: '', varieties: [] })
  renderForm(STOCK_ENTRY_NEW, client)

  await userEvent.type(await screen.findByLabelText('Grams'), '30')
  await userEvent.selectOptions(await screen.findByLabelText('Variety'), 'Sir Jack')
  await userEvent.click(screen.getByRole('button', { name: 'Save the entry' }))
  await screen.findByText('la lista de varieties')
  expect(client.getQueryState(catalogQueryOptions().queryKey)?.isInvalidated).toBe(true)
})

test('Cerrar with something typed asks before discarding, and leaving is refused until it is answered', async () => {
  fakeFor(stockOf([]))
  await renderFromVariety()

  await userEvent.type(await screen.findByLabelText('Grams'), '30')
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('Discard the entry?')
  expect(screen.queryByText('la página de la variety')).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'No, keep entering' }))
  expect(screen.getByLabelText('Grams')).toHaveValue('30')

  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Yes, discard it' }))
  expect(await screen.findByText('la página de la variety')).toBeInTheDocument()
})

// The gone exit (navigation.md, "A gone exit is the same move as Cerrar").
const ENTRY_10 = {
  id: 10,
  date: '2026-09-20',
  variety_id: 3,
  origin: 'harvest',
  grams: 25,
  total_cost: null,
  cost_per_gram: null,
  note: null,
}

function fakeGoneDelete() {
  fakeFor(stockOf([]), {
    'GET /stock/entries/10': () => jsonResponse(200, ENTRY_10),
    'DELETE /stock/entries/10': () => jsonResponse(404, { code: 'stock.entry_not_found', detail: 'x' }),
  })
}

async function deleteTheEntry() {
  await userEvent.click(await screen.findByRole('button', { name: 'Delete entry' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Yes, delete it' }))
}

const ENTRY_PATH = pathTo(STOCK_ENTRY, { id: 10 })

test('a gone delete, opened from All entries, goes back: the list is in history once, with the notice once', async () => {
  fakeGoneDelete()
  const { router } = renderGone([
    VARIETIES_PATH,
    STOCK,
    { pathname: ENTRY_PATH, state: inAppState({ pathname: STOCK }) },
  ])

  await deleteTheEntry()

  expect(await screen.findByText('todas las entradas')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(STOCK)
  expect(router.state.historyAction).toBe('POP')
  expect(screen.getAllByText(GONE_NOTICE)).toHaveLength(1)
  await act(() => router.navigate(-1))
  expect(router.state.location.pathname).toBe(VARIETIES_PATH)
  expect(screen.queryByText(GONE_NOTICE)).not.toBeInTheDocument()
})

test('a gone delete, opened from the variety list, replaces the entry with the list and leaves the screen behind alone', async () => {
  fakeGoneDelete()
  const { router } = renderGone([
    VARIETIES_PATH,
    { pathname: ENTRY_PATH, state: inAppState({ pathname: VARIETIES_PATH }) },
  ])

  await deleteTheEntry()

  expect(await screen.findByText('todas las entradas')).toBeInTheDocument()
  expect(router.state.historyAction).toBe('REPLACE')
  expect(screen.getAllByText(GONE_NOTICE)).toHaveLength(1)
  await act(() => router.navigate(-1))
  expect(router.state.location.pathname).toBe(VARIETIES_PATH)
  expect(screen.queryByText(GONE_NOTICE)).not.toBeInTheDocument()
})

test('a gone delete on a direct link replaces the entry with All entries and shows the notice', async () => {
  fakeGoneDelete()
  const { router } = renderGone([ENTRY_PATH])

  await deleteTheEntry()

  expect(await screen.findByText('todas las entradas')).toBeInTheDocument()
  expect(router.state.historyAction).toBe('REPLACE')
  expect(screen.getAllByText(GONE_NOTICE)).toHaveLength(1)
})

test('after a reload of the form (a fresh mount of the same history), the gone exit still goes back once', async () => {
  fakeGoneDelete()
  const { router, view, app } = renderGone([
    VARIETIES_PATH,
    STOCK,
    { pathname: ENTRY_PATH, state: inAppState({ pathname: STOCK }) },
  ])
  await screen.findByRole('button', { name: 'Delete entry' })
  view.unmount()
  render(app)

  await deleteTheEntry()

  expect(await screen.findByText('todas las entradas')).toBeInTheDocument()
  expect(router.state.historyAction).toBe('POP')
  expect(screen.getAllByText(GONE_NOTICE)).toHaveLength(1)
})

test('a resize across 900 px between opening and leaving does not change where the exit goes', async () => {
  fakeGoneDelete()
  stubViewport('phone')
  const { router } = renderGone([
    VARIETIES_PATH,
    STOCK,
    { pathname: ENTRY_PATH, state: inAppState({ pathname: STOCK }) },
  ])
  await screen.findByRole('button', { name: 'Delete entry' })
  stubViewport('computer')

  await deleteTheEntry()

  expect(await screen.findByText('todas las entradas')).toBeInTheDocument()
  expect(router.state.historyAction).toBe('POP')
})

test.each([
  ['a query string', `${STOCK}?page=2`],
  ['a trailing slash', `${STOCK}/`],
])('a from with %s still counts as the parent: the exit goes back', async (_name, from) => {
  fakeGoneDelete()
  const { router } = renderGone([
    VARIETIES_PATH,
    STOCK,
    { pathname: ENTRY_PATH, state: inAppState({ pathname: from }) },
  ])

  await deleteTheEntry()

  expect(await screen.findByText('todas las entradas')).toBeInTheDocument()
  expect(router.state.historyAction).toBe('POP')
  expect(screen.getAllByText(GONE_NOTICE)).toHaveLength(1)
})

test('editing an entry of an archived variety shows it as the chosen one, and offers no other archived variety', async () => {
  fakeFor(stockOf([]), {
    'GET /stock/entries/10': () =>
      jsonResponse(200, {
        id: 10,
        date: '2026-09-20',
        variety_id: 8,
        origin: 'harvest',
        grams: 25,
        total_cost: null,
        cost_per_gram: null,
        note: null,
      }),
    'GET /varieties?archived=true': () =>
      jsonResponse(200, [
        { id: 8, name: 'Vieja', archived: true, current_price: null },
        { id: 9, name: 'Otra archivada', archived: true, current_price: null },
      ]),
  })
  renderForm(pathTo(STOCK_ENTRY, { id: 10 }))

  const select = await screen.findByRole('combobox', { name: /^Variety/ })
  await waitFor(() => expect(select).toHaveValue('8'))
  expect(screen.getByRole('option', { name: 'Vieja' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Sir Jack' })).toBeInTheDocument()
  expect(screen.queryByRole('option', { name: 'Otra archivada' })).not.toBeInTheDocument()
})

test('a new entry never asks for the archived varieties', async () => {
  fakeFor(stockOf([]))
  renderForm(STOCK_ENTRY_NEW)

  await screen.findByRole('option', { name: 'Sir Jack' })
  expect(fetch).not.toHaveBeenCalledWith('/varieties?archived=true', expect.anything())
})

test('the form keeps the icon and text rule, its help lines within their limits', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/varieties') return Promise.resolve(jsonResponse(200, VARIETIES))
      if (url === '/stock') return Promise.resolve(jsonResponse(200, STOCK_VIEW))
      return Promise.resolve(jsonResponse(500, {}))
    }),
  )
  renderForm(STOCK_ENTRY_NEW)
  await screen.findByRole('option', { name: 'Sir Jack' })
  await userEvent.selectOptions(screen.getByLabelText('Variety'), 'Sir Jack')
  await screen.findByText('It has 18,5 g today')

  expect(document.querySelectorAll('[data-copy="help"]').length).toBeGreaterThanOrEqual(2)
  expectIconAndTextRule(document.body, { limits: LIMITS, optionClasses: ['pildora'] })
})
