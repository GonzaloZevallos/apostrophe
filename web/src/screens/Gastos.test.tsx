/**
 * `Gastos` at the screen seam (CODING_STANDARDS §10): Testing Library, the API
 * faked at `fetch`. Covers the monthly view, recording an expense, the category-
 * gone override on the form (PM round 3), and the delete confirmation.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import { SIN_CONEXION_TITULO } from '../components/SinConexion'
import { GONE_NOTICE } from '../api/refusals'
import type { Me } from '../api/me'
import Gastos, { CATEGORY_GONE, FLOWER_NOTICE } from './Gastos'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const ME: Me = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }

const CATEGORIES = [
  { id: 1, name: 'Packaging' },
  { id: 2, name: 'Otros' },
]

const VIEW = {
  month: '2026-10',
  total: 4500,
  categories: [
    {
      id: 1,
      name: 'Packaging',
      subtotal: 4500,
      expenses: [{ id: 9, spent_on: '2026-09-28', category_id: 1, amount: 4500, detail: 'Bolsas' }],
    },
  ],
}

function Provide() {
  return <Outlet context={ME} />
}

function renderGastos(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(fetchImpl))
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/gastos']}>
        <Routes>
          <Route element={<Provide />}>
            <Route path="/gastos" element={<Gastos />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.useRealTimers()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('shows the month\'s total, categories and expenses, and the fixed flower line', async () => {
  renderGastos(async (url) => {
    if (url.toString().startsWith('/expenses')) return jsonResponse(200, VIEW)
    if (url.toString().startsWith('/expense-categories')) return jsonResponse(200, CATEGORIES)
    throw new Error(`unexpected ${url}`)
  })

  expect((await screen.findAllByText('$ 4.500')).length).toBeGreaterThan(0)
  expect(screen.getByText('Packaging')).toBeInTheDocument()
  expect(screen.getByText('Bolsas')).toBeInTheDocument()
  expect(screen.getByText(FLOWER_NOTICE)).toBeInTheDocument()
})

test('recording an expense toasts "Gasto guardado" and refreshes the month', async () => {
  let posted: unknown = null
  renderGastos(async (url, init) => {
    const method = init?.method ?? 'GET'
    if (url.toString().startsWith('/expenses') && method === 'GET') return jsonResponse(200, VIEW)
    if (url.toString().startsWith('/expense-categories')) return jsonResponse(200, CATEGORIES)
    if (url.toString() === '/expenses' && method === 'POST') {
      posted = init?.body
      return jsonResponse(201, { id: 10, spent_on: '2026-10-02', category_id: 1, amount: 1000, detail: 'Cinta' })
    }
    throw new Error(`unexpected ${method} ${url}`)
  })

  await screen.findByText('Packaging')
  await userEvent.click(screen.getByRole('button', { name: 'Nuevo gasto' }))
  await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'Packaging')
  await userEvent.type(screen.getByLabelText('Monto'), '1000')
  await userEvent.type(screen.getByLabelText('Detalle'), 'Cinta')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByText('Gasto guardado')).toBeInTheDocument()
  expect(posted).toBe(
    JSON.stringify({ spent_on: '2026-10-02', category_id: 1, amount: 1000, detail: 'Cinta' }),
  )
})

test('a category removed mid-form keeps what was typed and empties Categoría', async () => {
  renderGastos(async (url, init) => {
    const method = init?.method ?? 'GET'
    if (url.toString().startsWith('/expenses') && method === 'GET') return jsonResponse(200, VIEW)
    if (url.toString().startsWith('/expense-categories')) return jsonResponse(200, CATEGORIES)
    if (url.toString() === '/expenses' && method === 'POST') {
      return jsonResponse(404, { detail: 'no category', code: 'expense_category.not_found' })
    }
    throw new Error(`unexpected ${method} ${url}`)
  })

  await screen.findByText('Packaging')
  await userEvent.click(screen.getByRole('button', { name: 'Nuevo gasto' }))
  await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'Packaging')
  await userEvent.type(screen.getByLabelText('Monto'), '1000')
  await userEvent.type(screen.getByLabelText('Detalle'), 'Cinta para embalar')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByText(CATEGORY_GONE)).toBeInTheDocument()
  expect(screen.getByLabelText('Categoría')).toHaveValue('')
  expect(screen.getByLabelText('Detalle')).toHaveValue('Cinta para embalar')
})

test('deleting an expense names its date, category and amount, then toasts', async () => {
  renderGastos(async (url, init) => {
    const method = init?.method ?? 'GET'
    if (url.toString().startsWith('/expenses') && method === 'GET') return jsonResponse(200, VIEW)
    if (url.toString().startsWith('/expense-categories')) return jsonResponse(200, CATEGORIES)
    if (url.toString() === '/expenses/9' && method === 'DELETE') {
      return new Response(null, { status: 204 })
    }
    throw new Error(`unexpected ${method} ${url}`)
  })

  await screen.findByText('Packaging')
  await userEvent.click(screen.getByText('Bolsas'))
  await userEvent.click(screen.getByRole('button', { name: 'Borrar gasto' }))

  const dialog = screen.getByText('¿Borrás el gasto?').closest('.panel')
  expect(dialog).not.toBeNull()
  expect(within(dialog as HTMLElement).getByText(/\$ 4\.500 en Packaging del 28\/09/)).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrala' }))

  expect(await screen.findByText('Gasto eliminado')).toBeInTheDocument()
})

test('editing an expense sends a PUT and toasts "Gasto guardado"', async () => {
  renderGastos(async (url, init) => {
    const method = init?.method ?? 'GET'
    if (url.toString().startsWith('/expenses') && method === 'GET') return jsonResponse(200, VIEW)
    if (url.toString().startsWith('/expense-categories')) return jsonResponse(200, CATEGORIES)
    if (url.toString() === '/expenses/9' && method === 'PUT') {
      return jsonResponse(200, { id: 9, spent_on: '2026-09-28', category_id: 1, amount: 5000, detail: 'Bolsas' })
    }
    throw new Error(`unexpected ${method} ${url}`)
  })

  await screen.findByText('Packaging')
  await userEvent.click(screen.getByText('Bolsas'))
  const amount = screen.getByLabelText('Monto')
  await userEvent.clear(amount)
  await userEvent.type(amount, '5000')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByText('Gasto guardado')).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/expenses/9', expect.objectContaining({ method: 'PUT' }))
})

test('editing an expense that is already gone shows the gone notice and closes the form', async () => {
  renderGastos(async (url, init) => {
    const method = init?.method ?? 'GET'
    if (url.toString().startsWith('/expenses') && method === 'GET') return jsonResponse(200, VIEW)
    if (url.toString().startsWith('/expense-categories')) return jsonResponse(200, CATEGORIES)
    if (url.toString() === '/expenses/9' && method === 'PUT') {
      return jsonResponse(404, { detail: 'no expense', code: 'expense.not_found' })
    }
    throw new Error(`unexpected ${method} ${url}`)
  })

  await screen.findByText('Packaging')
  await userEvent.click(screen.getByText('Bolsas'))
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByText(GONE_NOTICE)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()
})

test('deleting an expense that is already gone shows the gone notice', async () => {
  renderGastos(async (url, init) => {
    const method = init?.method ?? 'GET'
    if (url.toString().startsWith('/expenses') && method === 'GET') return jsonResponse(200, VIEW)
    if (url.toString().startsWith('/expense-categories')) return jsonResponse(200, CATEGORIES)
    if (url.toString() === '/expenses/9' && method === 'DELETE') {
      return jsonResponse(404, { detail: 'no expense', code: 'expense.not_found' })
    }
    throw new Error(`unexpected ${method} ${url}`)
  })

  await screen.findByText('Packaging')
  await userEvent.click(screen.getByText('Bolsas'))
  await userEvent.click(screen.getByRole('button', { name: 'Borrar gasto' }))
  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrala' }))

  expect(await screen.findByText(GONE_NOTICE)).toBeInTheDocument()
  expect(screen.queryByText('Gasto eliminado')).not.toBeInTheDocument()
})

test('a dropped network on delete shows "Sin conexión", never the gone notice', async () => {
  renderGastos(async (url, init) => {
    const method = init?.method ?? 'GET'
    if (url.toString().startsWith('/expenses') && method === 'GET') return jsonResponse(200, VIEW)
    if (url.toString().startsWith('/expense-categories')) return jsonResponse(200, CATEGORIES)
    if (url.toString() === '/expenses/9' && method === 'DELETE') {
      throw new TypeError('network error')
    }
    throw new Error(`unexpected ${method} ${url}`)
  })

  await screen.findByText('Packaging')
  await userEvent.click(screen.getByText('Bolsas'))
  await userEvent.click(screen.getByRole('button', { name: 'Borrar gasto' }))
  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrala' }))

  expect(await screen.findByText(SIN_CONEXION_TITULO)).toBeInTheDocument()
  expect(screen.queryByText(GONE_NOTICE)).not.toBeInTheDocument()
  // The confirmation stays open so the user can retry once back online.
  expect(screen.getByRole('button', { name: 'Sí, borrala' })).toBeInTheDocument()
})

test('a server error on the expense form shows the generic retry, never the refusal text', async () => {
  renderGastos(async (url, init) => {
    const method = init?.method ?? 'GET'
    if (url.toString().startsWith('/expenses') && method === 'GET') return jsonResponse(200, VIEW)
    if (url.toString().startsWith('/expense-categories')) return jsonResponse(200, CATEGORIES)
    if (url.toString() === '/expenses' && method === 'POST') {
      return new Response('internal error', { status: 500 })
    }
    throw new Error(`unexpected ${method} ${url}`)
  })

  await screen.findByText('Packaging')
  await userEvent.click(screen.getByRole('button', { name: 'Nuevo gasto' }))
  await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'Packaging')
  await userEvent.type(screen.getByLabelText('Monto'), '1000')
  await userEvent.type(screen.getByLabelText('Detalle'), 'Cinta')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByText(ERROR_GENERICO_MENSAJE)).toBeInTheDocument()
})

test('creating a category inside the expense form keeps what was typed and selects it', async () => {
  renderGastos(async (url, init) => {
    const method = init?.method ?? 'GET'
    if (url.toString().startsWith('/expenses') && method === 'GET') return jsonResponse(200, VIEW)
    if (url.toString() === '/expense-categories' && method === 'GET') return jsonResponse(200, CATEGORIES)
    if (url.toString() === '/expense-categories' && method === 'POST') {
      return jsonResponse(201, { id: 3, name: 'Insumos' })
    }
    throw new Error(`unexpected ${method} ${url}`)
  })

  await screen.findByText('Packaging')
  await userEvent.click(screen.getByRole('button', { name: 'Nuevo gasto' }))
  await userEvent.type(screen.getByLabelText('Detalle'), 'Sustrato nuevo')
  await userEvent.click(screen.getByRole('button', { name: 'Crear una categoría nueva' }))
  await userEvent.type(screen.getByLabelText('Nombre de la categoría nueva'), 'Insumos')
  await userEvent.click(screen.getByRole('button', { name: 'Crear categoría' }))

  await vi.waitFor(() => {
    expect(screen.getByLabelText('Categoría')).toHaveValue('3')
  })
  expect(screen.getByLabelText('Detalle')).toHaveValue('Sustrato nuevo')
})
