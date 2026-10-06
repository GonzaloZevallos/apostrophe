/**
 * `GastoCategorias` at the screen seam: add, rename and remove a category, and the
 * fixed refusal when removal is blocked because the category still has expenses
 * (`docs/product/expenses.md`, "Expense category").
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { GONE_NOTICE } from '../api/refusals'
import GastoCategorias, { CANNOT_REMOVE } from './GastoCategorias'
import { paths } from '../routes/paths'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const CATEGORIES = [{ id: 1, name: 'Packaging' }]

function renderScreen(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(fetchImpl))
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[paths.expenseCategories()]}>
        <GastoCategorias />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('lists categories and adds a new one with a fixed toast', async () => {
  renderScreen(async (url, init) => {
    const method = init?.method ?? 'GET'
    if (url.toString() === '/expense-categories' && method === 'GET') return jsonResponse(200, CATEGORIES)
    if (url.toString() === '/expense-categories' && method === 'POST') {
      return jsonResponse(201, { id: 2, name: 'Insumos' })
    }
    throw new Error(`unexpected ${method} ${url}`)
  })

  expect(await screen.findByText('Packaging')).toBeInTheDocument()

  await userEvent.type(screen.getByLabelText('Nueva categoría'), 'Insumos')
  await userEvent.click(screen.getByRole('button', { name: 'Agregar categoría' }))

  expect(await screen.findByText('Categoría guardada')).toBeInTheDocument()
})

test('a blocked removal shows the fixed refusal, naming no data', async () => {
  renderScreen(async (url, init) => {
    const method = init?.method ?? 'GET'
    if (url.toString() === '/expense-categories' && method === 'GET') return jsonResponse(200, CATEGORIES)
    if (url.toString() === '/expense-categories/1' && method === 'DELETE') {
      return jsonResponse(409, { detail: 'in use', code: 'expense_category.in_use' })
    }
    throw new Error(`unexpected ${method} ${url}`)
  })

  await screen.findByText('Packaging')
  await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrala' }))

  expect(await screen.findByText(CANNOT_REMOVE)).toBeInTheDocument()
})

test('renaming a category toasts "Categoría guardada"', async () => {
  renderScreen(async (url, init) => {
    const method = init?.method ?? 'GET'
    if (url.toString() === '/expense-categories' && method === 'GET') return jsonResponse(200, CATEGORIES)
    if (url.toString() === '/expense-categories/1' && method === 'PATCH') {
      return jsonResponse(200, { id: 1, name: 'Empaque' })
    }
    throw new Error(`unexpected ${method} ${url}`)
  })

  await screen.findByText('Packaging')
  await userEvent.click(screen.getByRole('button', { name: 'Renombrar' }))
  const input = screen.getByLabelText('Nombre de Packaging')
  await userEvent.clear(input)
  await userEvent.type(input, 'Empaque')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByText('Categoría guardada')).toBeInTheDocument()
})

test('renaming a category that is already gone shows the gone notice', async () => {
  renderScreen(async (url, init) => {
    const method = init?.method ?? 'GET'
    if (url.toString() === '/expense-categories' && method === 'GET') return jsonResponse(200, CATEGORIES)
    if (url.toString() === '/expense-categories/1' && method === 'PATCH') {
      return jsonResponse(404, { detail: 'no category', code: 'expense_category.not_found' })
    }
    throw new Error(`unexpected ${method} ${url}`)
  })

  await screen.findByText('Packaging')
  await userEvent.click(screen.getByRole('button', { name: 'Renombrar' }))
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  const notice = await screen.findByText(GONE_NOTICE)
  expect(notice).toBeInTheDocument()
  // Same floating slot the "Categoría guardada"/"Categoría eliminada" toast
  // uses (`Aviso`; review finding e2e).
  expect(notice.closest('.aviso-flotante')).not.toBeNull()
})

test('removing a category that is already gone shows the gone notice, not the refusal text', async () => {
  renderScreen(async (url, init) => {
    const method = init?.method ?? 'GET'
    if (url.toString() === '/expense-categories' && method === 'GET') return jsonResponse(200, CATEGORIES)
    if (url.toString() === '/expense-categories/1' && method === 'DELETE') {
      return jsonResponse(404, { detail: 'no category', code: 'expense_category.not_found' })
    }
    throw new Error(`unexpected ${method} ${url}`)
  })

  await screen.findByText('Packaging')
  await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrala' }))

  expect(await screen.findByText(GONE_NOTICE)).toBeInTheDocument()
  expect(screen.queryByText(CANNOT_REMOVE)).not.toBeInTheDocument()
})
