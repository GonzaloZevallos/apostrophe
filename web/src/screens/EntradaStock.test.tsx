/**
 * `EntradaStock` at the screen seam (`stock.md`, "Nueva entrada" and "Editing an
 * entry"): records a new entry (with today filled in and "Hoy tiene N g" under the
 * variety), lets an adjustment carry negative grams, refuses a purchase with no cost
 * on its own field, confirms before saving an edit, and confirms before deleting,
 * naming the date, variety and grams.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider, useLocation } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { catalogQueryOptions } from '../api/catalog'
import type { Me } from '../api/me'
import FlashProvider from '../flash/FlashProvider'
import EntradaStock from './EntradaStock'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03' }

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function Where({ label }: { label: string }) {
  const location = useLocation()
  const state = location.state as { notice?: string } | null
  return (
    <div>
      <span>{label}</span>
      <span data-testid="where">{location.pathname}</span>
      {state?.notice !== undefined && <span>{state.notice}</span>}
    </div>
  )
}

function Provide() {
  return (
    <FlashProvider>
      <Outlet context={ME} />
    </FlashProvider>
  )
}

function renderForm(
  initialPath: string | string[],
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  const entries = typeof initialPath === 'string' ? [initialPath] : initialPath
  const router = createMemoryRouter(
    [
      {
        element: <Provide />,
        children: [
          { path: '/varieties/entries/new', element: <EntradaStock mode="nuevo" /> },
          { path: '/varieties/entries/:id', element: <EntradaStock mode="editar" /> },
          { path: '/varieties/entries', element: <Where label="todas las entradas" /> },
          { path: '/varieties/:id', element: <Where label="la página de la variedad" /> },
          { path: '/varieties', element: <Where label="la lista de variedades" /> },
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
  renderForm('/varieties/entries/new')

  expect(screen.getByLabelText('Fecha')).toHaveValue('2026-10-03')

  await screen.findByRole('option', { name: 'Sir Jack' })
  await userEvent.selectOptions(screen.getByLabelText('Variedad'), 'Sir Jack')

  expect(await screen.findByText('Hoy tiene 18,5 g')).toBeInTheDocument()
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
  renderForm('/varieties/entries/new')

  await userEvent.type(screen.getByLabelText('Gramos'), '30')
  await userEvent.selectOptions(await screen.findByLabelText('Variedad'), 'Sir Jack')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá la entrada' }))

  expect(await screen.findByText('la lista de variedades')).toBeInTheDocument()
  expect(await screen.findByText('Entrada guardada')).toBeInTheDocument()
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
  renderForm('/varieties/entries/new')

  await userEvent.type(screen.getByLabelText('Gramos'), '-4,5')
  await userEvent.selectOptions(await screen.findByLabelText('Variedad'), 'Sir Jack')
  await userEvent.click(screen.getByRole('button', { name: 'Ajuste' }))
  await userEvent.click(screen.getByRole('button', { name: 'Guardá la entrada' }))

  expect(await screen.findByText('la lista de variedades')).toBeInTheDocument()
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
  renderForm('/varieties/entries/12')

  expect(await screen.findByLabelText('Gramos')).toHaveValue('-4.5')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Sí, guardar' }))

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
  renderForm('/varieties/entries/new')

  await userEvent.type(screen.getByLabelText('Gramos'), '30')
  await userEvent.selectOptions(await screen.findByLabelText('Variedad'), 'Sir Jack')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá la entrada' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Una compra necesita un costo total')
  expect(screen.getByLabelText('Gramos')).toHaveValue('30')
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
  renderForm('/varieties/entries/10')

  expect(await screen.findByLabelText('Gramos')).toHaveValue('25')
  await userEvent.clear(screen.getByLabelText('Gramos'))
  await userEvent.type(screen.getByLabelText('Gramos'), '28')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByRole('alertdialog')).toHaveTextContent('¿Guardás los cambios?')
  expect(fetch).not.toHaveBeenCalledWith('/stock/entries/10', expect.objectContaining({ method: 'PUT' }))

  await userEvent.click(screen.getByRole('button', { name: 'Sí, guardar' }))

  expect(await screen.findByText('todas las entradas')).toBeInTheDocument()
  expect(await screen.findByText('Entrada guardada')).toBeInTheDocument()
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
  renderForm('/varieties/entries/10')

  await userEvent.click(await screen.findByRole('button', { name: 'Borrar entrada' }))

  const dialog = await screen.findByRole('alertdialog')
  expect(dialog).toHaveTextContent('20/09')
  expect(dialog).toHaveTextContent('Sir Jack')
  expect(dialog).toHaveTextContent('25 g')

  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrala' }))

  expect(await screen.findByText('todas las entradas')).toBeInTheDocument()
  expect(await screen.findByText('Entrada eliminada')).toBeInTheDocument()
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
  renderForm('/varieties/entries/10')

  await userEvent.click(await screen.findByRole('button', { name: 'Borrar entrada' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Sí, borrala' }))

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

test('an entry started from a variety has it chosen and "Stock inicial" preselected when it has no entries', async () => {
  fakeFor(stockOf([]))
  renderForm('/varieties/entries/new?variety=3')

  const select = await screen.findByRole('combobox', { name: /^Variedad/ })
  await waitFor(() => expect(select).toHaveValue('3'))
  expect(screen.getByRole('button', { name: 'Stock inicial' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Compra' })).toHaveAttribute('aria-pressed', 'false')
})

test('an entry started from a variety that already has entries keeps Compra', async () => {
  fakeFor(stockOf([{ id: 1, variety_id: 3 }]))
  renderForm('/varieties/entries/new?variety=3')

  const select = await screen.findByRole('combobox', { name: /^Variedad/ })
  await waitFor(() => expect(select).toHaveValue('3'))
  expect(screen.getByRole('button', { name: 'Compra' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Stock inicial' })).toHaveAttribute('aria-pressed', 'false')
})

test("another variety's entries do not stop 'Stock inicial' from being preselected", async () => {
  fakeFor(stockOf([{ id: 1, variety_id: 9 }]))
  renderForm('/varieties/entries/new?variety=3')

  const select = await screen.findByRole('combobox', { name: /^Variedad/ })
  await waitFor(() => expect(select).toHaveValue('3'))
  expect(screen.getByRole('button', { name: 'Stock inicial' })).toHaveAttribute('aria-pressed', 'true')
})

test('from "+ Entrada de stock" no variety is chosen and Compra is the origin', async () => {
  fakeFor(stockOf([]))
  renderForm('/varieties/entries/new')

  expect(await screen.findByRole('combobox', { name: /^Variedad/ })).toHaveValue('')
  expect(screen.getByRole('button', { name: 'Compra' })).toHaveAttribute('aria-pressed', 'true')
})

test('Cerrar goes back by history to where the form was opened', async () => {
  fakeFor(stockOf([]))
  renderForm(['/varieties/3', '/varieties/entries/new?variety=3'])

  await userEvent.click(await screen.findByRole('button', { name: 'Cerrar' }))
  expect(await screen.findByText('la página de la variedad')).toBeInTheDocument()
  expect(screen.getByTestId('where')).toHaveTextContent('/varieties/3')
})

test('Cerrar with no history goes to Variedades for a new entry and to "Todas las entradas" for an edit', async () => {
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
  const first = renderForm('/varieties/entries/new')
  await userEvent.click(await screen.findByRole('button', { name: 'Cerrar' }))
  expect(await screen.findByText('la lista de variedades')).toBeInTheDocument()
  first.clear()
  cleanup()

  renderForm('/varieties/entries/10')
  await userEvent.click(await screen.findByRole('button', { name: 'Cerrar' }))
  expect(await screen.findByText('todas las entradas')).toBeInTheDocument()
})

test('a save goes back by history too, and says "Entrada guardada" there', async () => {
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
  renderForm(['/varieties/3', '/varieties/entries/new?variety=3'])

  await userEvent.type(await screen.findByLabelText('Gramos'), '30')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá la entrada' }))
  expect(await screen.findByText('la página de la variedad')).toBeInTheDocument()
  expect(await screen.findByText('Entrada guardada')).toBeInTheDocument()
})

test('a missing or foreign entry shows "Eso ya no está." with "Volver a Variedades"', async () => {
  fakeFor(stockOf([]), {
    'GET /stock/entries/99': () => jsonResponse(404, { code: 'stock.entry_not_found', detail: 'x' }),
  })
  renderForm('/varieties/entries/99')

  expect(await screen.findByText('Eso ya no está.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Volver a Variedades' })).toHaveAttribute('href', '/varieties')
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
  renderForm('/varieties/entries/new', client)

  await userEvent.type(await screen.findByLabelText('Gramos'), '30')
  await userEvent.selectOptions(await screen.findByLabelText('Variedad'), 'Sir Jack')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá la entrada' }))
  await screen.findByText('la lista de variedades')
  expect(client.getQueryState(catalogQueryOptions().queryKey)?.isInvalidated).toBe(true)
})

test('Cerrar with something typed asks before discarding, and leaving is refused until it is answered', async () => {
  fakeFor(stockOf([]))
  renderForm(['/varieties/3', '/varieties/entries/new?variety=3'])

  await userEvent.type(await screen.findByLabelText('Gramos'), '30')
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('¿Descartás la entrada?')
  expect(screen.queryByText('la página de la variedad')).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'No, seguí cargando' }))
  expect(screen.getByLabelText('Gramos')).toHaveValue('30')

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Sí, descartalo' }))
  expect(await screen.findByText('la página de la variedad')).toBeInTheDocument()
})
