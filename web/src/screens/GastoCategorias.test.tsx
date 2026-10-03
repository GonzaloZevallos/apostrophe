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
import GastoCategorias, { CANNOT_REMOVE } from './GastoCategorias'

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
      <MemoryRouter initialEntries={['/gastos/categorias']}>
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
