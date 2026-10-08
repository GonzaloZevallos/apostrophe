/**
 * `ExpenseCategoriesEditor` at the component seam (the Onboarding's categories step reuses it):
 * adding goes through the owner's route, a refused removal shows the fixed line, and the
 * parent hears whether something typed is not saved yet. The API is faked at `fetch`.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import ExpenseCategoriesEditor, { CANNOT_REMOVE } from './ExpenseCategoriesEditor'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>

function renderEditor(fetchImpl: Fetch, onDirtyChange: (dirty: boolean) => void = () => undefined) {
  const fetchMock = vi.fn(fetchImpl)
  vi.stubGlobal('fetch', fetchMock)
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ExpenseCategoriesEditor onDirtyChange={onDirtyChange} />
    </QueryClientProvider>,
  )
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('adding a category goes through the owner route and clears the dirty flag', async () => {
  const onDirtyChange = vi.fn()
  const fetchMock = renderEditor(async (url, init) => {
    if (url === '/expense-categories' && init?.method === 'POST') {
      return jsonResponse(201, { id: 2, name: 'Insumos' })
    }
    if (url === '/expense-categories') return jsonResponse(200, [{ id: 1, name: 'Packaging' }])
    throw new Error(`unexpected ${url}`)
  }, onDirtyChange)

  await screen.findByText('Packaging')
  await userEvent.type(screen.getByLabelText('Nueva categoría'), 'Insumos')
  expect(onDirtyChange).toHaveBeenLastCalledWith(true)
  await userEvent.click(screen.getByRole('button', { name: '+ Categoría' }))

  expect(await screen.findByText('Categoría guardada')).toBeInTheDocument()
  expect(screen.getByText('Insumos')).toBeInTheDocument()
  const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
  expect(post?.[0]).toBe('/expense-categories')
  expect(JSON.parse(String(post?.[1]?.body))).toEqual({ name: 'Insumos' })
  expect(onDirtyChange).toHaveBeenLastCalledWith(false)
})

test('a category still in use cannot be removed, and the refusal shows', async () => {
  renderEditor(async (url, init) => {
    if (url === '/expense-categories/1' && init?.method === 'DELETE') {
      return jsonResponse(409, { detail: 'in use', code: 'expense_category.in_use' })
    }
    if (url === '/expense-categories') return jsonResponse(200, [{ id: 1, name: 'Packaging' }])
    throw new Error(`unexpected ${url}`)
  })

  await screen.findByText('Packaging')
  await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrala' }))

  expect(await screen.findByText(CANNOT_REMOVE)).toBeInTheDocument()
  expect(screen.getByText('Packaging')).toBeInTheDocument()
})
