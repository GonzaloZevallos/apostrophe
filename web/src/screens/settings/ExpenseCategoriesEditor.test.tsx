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
import { CATEGORIES_SAVE_AT_ONCE } from '../../copy/settings'

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
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }))

  expect(await screen.findByText(CANNOT_REMOVE)).toBeInTheDocument()
  expect(screen.getByText('Packaging')).toBeInTheDocument()
})

function renderCollapsed(fetchImpl: Fetch) {
  const fetchMock = vi.fn(fetchImpl)
  vi.stubGlobal('fetch', fetchMock)
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ExpenseCategoriesEditor onDirtyChange={() => undefined} addCollapsed />
    </QueryClientProvider>,
  )
  return fetchMock
}

const listOnly: Fetch = async (url) => {
  if (url === '/expense-categories') return jsonResponse(200, [{ id: 1, name: 'Packaging' }])
  throw new Error(`unexpected ${url}`)
}

test('with no props the "Nueva categoría" field is always there and no save line shows', async () => {
  renderEditor(listOnly)
  await screen.findByText('Packaging')
  expect(screen.getByLabelText('Nueva categoría')).toBeInTheDocument()
  expect(screen.queryByText(CATEGORIES_SAVE_AT_ONCE)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Category' })).not.toBeInTheDocument()
})

test('collapsed, only the add action and the save line show; the add action opens the field and focuses it', async () => {
  renderCollapsed(listOnly)
  await screen.findByText('Packaging')

  expect(screen.queryByLabelText('Nueva categoría')).not.toBeInTheDocument()
  expect(screen.getByText(CATEGORIES_SAVE_AT_ONCE)).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Category' }))
  expect(screen.getByLabelText('Nueva categoría')).toHaveFocus()
})

test('collapsed, a submit saves with no other action, collapses the field and gives focus back to the add action', async () => {
  const fetchMock = renderCollapsed(async (url, init) => {
    if (url === '/expense-categories' && init?.method === 'POST') return jsonResponse(201, { id: 2, name: 'Luz' })
    return listOnly(url, init)
  })
  await screen.findByText('Packaging')
  await userEvent.click(screen.getByRole('button', { name: 'Category' }))
  await userEvent.type(screen.getByLabelText('Nueva categoría'), 'Luz')
  await userEvent.click(screen.getByRole('button', { name: '+ Categoría' }))

  expect(await screen.findByText('Categoría guardada')).toBeInTheDocument()
  const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
  expect(JSON.parse(String(post?.[1]?.body))).toEqual({ name: 'Luz' })
  expect(screen.getByText('Luz')).toBeInTheDocument()
  expect(screen.queryByLabelText('Nueva categoría')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Category' })).toHaveFocus()
})

test('collapsed, a refusal keeps the field open with what was typed', async () => {
  renderCollapsed(async (url, init) => {
    if (url === '/expense-categories' && init?.method === 'POST') {
      return jsonResponse(422, { detail: 'invalid', code: 'expense_category.name_invalid' })
    }
    return listOnly(url, init)
  })
  await screen.findByText('Packaging')
  await userEvent.click(screen.getByRole('button', { name: 'Category' }))
  await userEvent.type(screen.getByLabelText('Nueva categoría'), 'Luz')
  await userEvent.click(screen.getByRole('button', { name: '+ Categoría' }))

  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(screen.getByLabelText('Nueva categoría')).toHaveValue('Luz')
})

test('collapsed, text typed and not saved counts as unsaved', async () => {
  const onDirtyChange = vi.fn()
  vi.stubGlobal('fetch', vi.fn(listOnly))
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ExpenseCategoriesEditor onDirtyChange={onDirtyChange} addCollapsed />
    </QueryClientProvider>,
  )
  await screen.findByText('Packaging')
  await userEvent.click(screen.getByRole('button', { name: 'Category' }))
  await userEvent.type(screen.getByLabelText('Nueva categoría'), 'Luz')
  expect(onDirtyChange).toHaveBeenLastCalledWith(true)
})

test('collapsed, a rename saves at once through the owner route, with no other write', async () => {
  const fetchMock = renderCollapsed(async (url, init) => {
    if (url === '/expense-categories/1' && init?.method === 'PATCH') return jsonResponse(200, { id: 1, name: 'Embalaje' })
    return listOnly(url, init)
  })
  await screen.findByText('Packaging')
  await userEvent.click(screen.getByRole('button', { name: 'Renombrar' }))
  const input = screen.getByLabelText('Nombre de Packaging')
  await userEvent.clear(input)
  await userEvent.type(input, 'Embalaje')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('Embalaje')).toBeInTheDocument()
  expect(screen.queryByText('Packaging')).not.toBeInTheDocument()
  const requests = fetchMock.mock.calls
    .filter(([, init]) => init?.method !== undefined && init.method !== 'GET')
    .map(([url, init]) => `${init?.method} ${url}`)
  expect(requests).toEqual(['PATCH /expense-categories/1'])
  expect(JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')?.[1]?.body))).toEqual({ name: 'Embalaje' })
})

test('collapsed, a removal saves at once through the owner route, with no other write', async () => {
  const fetchMock = renderCollapsed(async (url, init) => {
    if (url === '/expense-categories/1' && init?.method === 'DELETE') return new Response(null, { status: 204 })
    return listOnly(url, init)
  })
  await screen.findByText('Packaging')
  await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }))

  expect(await screen.findByText('Categoría eliminada')).toBeInTheDocument()
  expect(screen.queryByText('Packaging')).not.toBeInTheDocument()
  const requests = fetchMock.mock.calls
    .filter(([, init]) => init?.method !== undefined && init.method !== 'GET')
    .map(([url, init]) => `${init?.method} ${url}`)
  expect(requests).toEqual(['DELETE /expense-categories/1'])
})
