/**
 * `EntradaStock` at the screen seam (`stock.md`, "Nueva entrada" and "Editing an
 * entry"): records a new entry (with today filled in and "Hoy tiene N g" under the
 * variety), lets an adjustment carry negative grams, refuses a purchase with no cost
 * on its own field, confirms before saving an edit, and confirms before deleting,
 * naming the date, variety and grams.
 */

import { STOCK, STOCK_ENTRY, STOCK_ENTRY_NEW, pathTo } from '../routes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Link, Outlet, RouterProvider, useLocation } from 'react-router'
import FlashProvider from '../flash/FlashProvider'
import { afterEach, expect, test, vi } from 'vitest'
import type { Me } from '../api/me'
import EntradaStock from './EntradaStock'

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03' }

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function ListStub() {
  const location = useLocation()
  const state = location.state as { toast?: string; notice?: string } | null
  return (
    <div>
      <span>la lista de stock</span>
      {state?.toast !== undefined && <span>{state.toast}</span>}
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

function renderForm(initialPath: string, previous?: string) {
  const router = createMemoryRouter(
    [
      {
        element: <Provide />,
        children: [
          { path: STOCK_ENTRY_NEW, element: <EntradaStock mode="nuevo" /> },
          { path: STOCK_ENTRY, element: <EntradaStock mode="editar" /> },
          {
            path: STOCK,
            element: (
              <>
                <ListStub />
                <Link to={STOCK_ENTRY_NEW} state={{ inApp: true }}>
                  Abrir la entrada
                </Link>
              </>
            ),
          },
        ],
      },
    ],
    previous === undefined
      ? { initialEntries: [initialPath] }
      : { initialEntries: [previous, initialPath], initialIndex: 1 },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
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
  renderForm(STOCK_ENTRY_NEW)

  await userEvent.type(screen.getByLabelText('Gramos'), '30')
  await userEvent.selectOptions(await screen.findByLabelText('Variedad'), 'Sir Jack')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá la entrada' }))

  expect(await screen.findByText('la lista de stock')).toBeInTheDocument()
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
  renderForm(STOCK_ENTRY_NEW)

  await userEvent.type(screen.getByLabelText('Gramos'), '-4,5')
  await userEvent.selectOptions(await screen.findByLabelText('Variedad'), 'Sir Jack')
  await userEvent.click(screen.getByRole('button', { name: 'Ajuste' }))
  await userEvent.click(screen.getByRole('button', { name: 'Guardá la entrada' }))

  expect(await screen.findByText('la lista de stock')).toBeInTheDocument()
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

  expect(await screen.findByLabelText('Gramos')).toHaveValue('-4.5')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Sí, guardar' }))

  expect(await screen.findByText('la lista de stock')).toBeInTheDocument()
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
  renderForm(pathTo(STOCK_ENTRY, { id: 10 }))

  expect(await screen.findByLabelText('Gramos')).toHaveValue('25')
  await userEvent.clear(screen.getByLabelText('Gramos'))
  await userEvent.type(screen.getByLabelText('Gramos'), '28')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByRole('alertdialog')).toHaveTextContent('¿Guardás los cambios?')
  expect(fetch).not.toHaveBeenCalledWith('/stock/entries/10', expect.objectContaining({ method: 'PUT' }))

  await userEvent.click(screen.getByRole('button', { name: 'Sí, guardar' }))

  expect(await screen.findByText('la lista de stock')).toBeInTheDocument()
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

  await userEvent.click(await screen.findByRole('button', { name: 'Borrar entrada' }))

  const dialog = await screen.findByRole('alertdialog')
  expect(dialog).toHaveTextContent('20/09')
  expect(dialog).toHaveTextContent('Sir Jack')
  expect(dialog).toHaveTextContent('25 g')

  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrala' }))

  expect(await screen.findByText('la lista de stock')).toBeInTheDocument()
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
  renderForm(pathTo(STOCK_ENTRY, { id: 10 }))

  await userEvent.click(await screen.findByRole('button', { name: 'Borrar entrada' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Sí, borrala' }))

  expect(await screen.findByText('la lista de stock')).toBeInTheDocument()
  expect(getEntryCalls).toBe(1)
})

function stubApi(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/varieties') return Promise.resolve(jsonResponse(200, VARIETIES))
      if (url === '/stock') return Promise.resolve(jsonResponse(200, STOCK_VIEW))
      if (url === '/stock/entries' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse(201, { id: 1 }))
      }
      return Promise.resolve(jsonResponse(500, {}))
    }),
  )
}

async function openFromList(): Promise<ReturnType<typeof renderForm>> {
  stubApi()
  const router = renderForm(STOCK)
  await userEvent.click(screen.getByRole('link', { name: 'Abrir la entrada' }))
  expect(router.state.location.pathname).toBe(STOCK_ENTRY_NEW)
  return router
}

test('closing, or going back by history, with something typed asks the same question', async () => {
  const router = await openFromList()
  await userEvent.type(screen.getByLabelText('Gramos'), '10')

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  const viaCerrar = screen.getByRole('alertdialog').textContent
  await userEvent.click(screen.getByRole('button', { name: 'No, seguí cargando' }))
  expect(router.state.location.pathname).toBe(STOCK_ENTRY_NEW)
  expect(screen.getByLabelText('Gramos')).toHaveValue('10')

  await act(() => router.navigate(-1))
  expect(screen.getByRole('alertdialog').textContent).toBe(viaCerrar)
  expect(viaCerrar).toContain('¿Descartás la entrada?')
  expect(router.state.location.pathname).toBe(STOCK_ENTRY_NEW)

  await userEvent.click(screen.getByRole('button', { name: 'Sí, descartala' }))
  expect(await screen.findByText('la lista de stock')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(STOCK)
})

test('an untouched form closes at once, by history', async () => {
  const router = await openFromList()

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(router.state.location.pathname).toBe(STOCK)
  expect(router.state.historyAction).toBe('POP')
})

test('with no in-app history, Cerrar goes to the stock list replacing the form', async () => {
  stubApi()
  const router = renderForm(STOCK_ENTRY_NEW, '/otra')

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('la lista de stock')).toBeInTheDocument()
  expect(router.state.historyAction).toBe('REPLACE')
})

test('after a save, history goes back to Stock with the toast: a pop, no second Stock entry', async () => {
  const router = await openFromList()
  await userEvent.type(screen.getByLabelText('Gramos'), '10')
  await userEvent.selectOptions(screen.getByLabelText('Variedad'), 'Sir Jack')
  await userEvent.type(screen.getByLabelText(/Costo total/), '5000')

  await userEvent.click(screen.getByRole('button', { name: 'Guardá la entrada' }))

  expect(await screen.findByText('Entrada guardada')).toBeInTheDocument()
  expect(await screen.findByText('la lista de stock')).toBeInTheDocument()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(router.state.location.pathname).toBe(STOCK)
  expect(router.state.historyAction).toBe('POP')
})

test('with no in-app history, a save replaces the form with Stock and still toasts', async () => {
  stubApi()
  const router = renderForm(STOCK_ENTRY_NEW, '/otra')
  await userEvent.type(screen.getByLabelText('Gramos'), '10')
  await userEvent.selectOptions(await screen.findByLabelText('Variedad'), 'Sir Jack')
  await userEvent.type(screen.getByLabelText(/Costo total/), '5000')

  await userEvent.click(screen.getByRole('button', { name: 'Guardá la entrada' }))

  expect(await screen.findByText('Entrada guardada')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(STOCK)
  expect(router.state.historyAction).toBe('REPLACE')
})
