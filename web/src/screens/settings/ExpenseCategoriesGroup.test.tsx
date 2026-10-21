/**
 * `ExpenseCategoriesGroup` at the screen seam: add, rename and remove a category, the fixed
 * refusal when removal is blocked because the category still has expenses
 * (`docs/product/expenses.md`, "Expense category"), and the form rule: "Close", and the
 * unsaved-changes ask measured against what the server last accepted, never the query cache.
 * The API is faked at `fetch`.
 */

import { EXPENSE_CATEGORIES, SETTINGS } from '../../routes'
import { inAppState } from '../../components/inAppState'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { GONE_NOTICE } from '../../api/refusals'
import { SIN_CONEXION_MENSAJE } from '../../copy/common'
import { expectIconAndTextRule } from '../../test/iconAndTextRule'
import ExpenseCategoriesGroup, { CANNOT_REMOVE } from './ExpenseCategoriesGroup'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const CATEGORIES = [{ id: 1, name: 'Packaging' }]

type Fetch = (url: string, init?: RequestInit) => Promise<Response>

function renderGroup(fetchImpl: Fetch) {
  vi.stubGlobal('fetch', vi.fn(fetchImpl))
  const router = createMemoryRouter(
    [
      { path: SETTINGS, element: <div>Lista de grupos</div> },
      { path: EXPENSE_CATEGORIES, element: <ExpenseCategoriesGroup /> },
    ],
    {
      initialEntries: [SETTINGS, { pathname: EXPENSE_CATEGORIES, state: inAppState({ pathname: SETTINGS }) }],
      initialIndex: 1,
    },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

function serving(extra?: Fetch): Fetch {
  return async (url, init) => {
    const method = init?.method ?? 'GET'
    if (url === '/expense-categories' && method === 'GET') return jsonResponse(200, CATEGORIES)
    if (extra !== undefined) return extra(url, init)
    throw new Error(`unexpected ${method} ${url}`)
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('lists categories and adds a new one with a fixed toast', async () => {
  renderGroup(
    serving(async (url, init) => {
      if (url === '/expense-categories' && init?.method === 'POST') {
        return jsonResponse(201, { id: 2, name: 'Insumos' })
      }
      throw new Error(`unexpected ${url}`)
    }),
  )

  expect(await screen.findByText('Packaging')).toBeInTheDocument()

  await userEvent.type(screen.getByLabelText('New category'), 'Insumos')
  await userEvent.click(screen.getByRole('button', { name: '+ Category' }))

  expect(await screen.findByText('Category saved')).toBeInTheDocument()
  expect(screen.getByText('Insumos')).toBeInTheDocument()
  expect(screen.getByLabelText('New category')).toHaveValue('')
})

test('with no categories it shows an empty list and the add action', async () => {
  renderGroup(async () => jsonResponse(200, []))

  expect(await screen.findByLabelText('New category')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '+ Category' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument()
})

test('a blocked removal shows the fixed refusal, naming no data', async () => {
  renderGroup(
    serving(async (url, init) => {
      if (url === '/expense-categories/1' && init?.method === 'DELETE') {
        return jsonResponse(409, { detail: 'in use', code: 'expense_category.in_use' })
      }
      throw new Error(`unexpected ${url}`)
    }),
  )

  await screen.findByText('Packaging')
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }))

  expect(await screen.findByText(CANNOT_REMOVE)).toBeInTheDocument()
  expect(screen.getByText('Packaging')).toBeInTheDocument()
})

test('removing a category toasts "Category deleted" and drops the row', async () => {
  renderGroup(
    serving(async (url, init) => {
      if (url === '/expense-categories/1' && init?.method === 'DELETE') {
        return new Response(null, { status: 204 })
      }
      throw new Error(`unexpected ${url}`)
    }),
  )

  await screen.findByText('Packaging')
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }))

  expect(await screen.findByText('Category deleted')).toBeInTheDocument()
  expect(screen.queryByText('Packaging')).not.toBeInTheDocument()
})

test('renaming a category toasts "Category saved" and shows what the server answered', async () => {
  renderGroup(
    serving(async (url, init) => {
      if (url === '/expense-categories/1' && init?.method === 'PATCH') {
        return jsonResponse(200, { id: 1, name: 'Empaque' })
      }
      throw new Error(`unexpected ${url}`)
    }),
  )

  await screen.findByText('Packaging')
  await userEvent.click(screen.getByRole('button', { name: 'Rename' }))
  const input = screen.getByLabelText('Name of Packaging')
  await userEvent.clear(input)
  await userEvent.type(input, '  empaque  ')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('Category saved')).toBeInTheDocument()
  expect(screen.getByText('Empaque')).toBeInTheDocument()
})

test('after an add or a rename the list keeps the server order, by name without case', async () => {
  renderGroup(
    async (url, init) => {
      const method = init?.method ?? 'GET'
      if (url === '/expense-categories' && method === 'GET') {
        return jsonResponse(200, [
          { id: 1, name: 'Bolsas' },
          { id: 2, name: 'Packaging' },
        ])
      }
      if (url === '/expense-categories' && method === 'POST') return jsonResponse(201, { id: 3, name: 'alquiler' })
      if (url === '/expense-categories/2' && method === 'PATCH') return jsonResponse(200, { id: 2, name: 'Cajas' })
      throw new Error(`unexpected ${method} ${url}`)
    },
  )

  await screen.findByText('Bolsas')
  await userEvent.type(screen.getByLabelText('New category'), 'alquiler')
  await userEvent.click(screen.getByRole('button', { name: '+ Category' }))
  await screen.findByText('alquiler')
  // Rows are in the order of their rename buttons: alquiler, Bolsas, Packaging.
  const rename = async (index: number, current: string): Promise<void> => {
    await userEvent.click(screen.getAllByRole('button', { name: 'Rename' })[index] as HTMLElement)
    expect(screen.getByLabelText(`Name of ${current}`)).toBeInTheDocument()
  }
  await rename(2, 'Packaging')
  const input = screen.getByLabelText('Name of Packaging')
  await userEvent.clear(input)
  await userEvent.type(input, 'Cajas')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await screen.findByText('Cajas')

  // Cajas sorts between Bolsas and alquiler's case-folded place: alquiler, Bolsas, Cajas.
  await rename(2, 'Cajas')
})

test('renaming a category that is already gone shows the gone notice and drops the row', async () => {
  renderGroup(
    serving(async (url, init) => {
      if (url === '/expense-categories/1' && init?.method === 'PATCH') {
        return jsonResponse(404, { detail: 'no category', code: 'expense_category.not_found' })
      }
      throw new Error(`unexpected ${url}`)
    }),
  )

  await screen.findByText('Packaging')
  await userEvent.click(screen.getByRole('button', { name: 'Rename' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  const notice = await screen.findByText(GONE_NOTICE)
  // Same floating slot the "Category saved"/"Category deleted" toast uses.
  expect(notice.closest('.aviso-flotante')).not.toBeNull()
  expect(screen.queryByText('Packaging')).not.toBeInTheDocument()
})

test('removing a category that is already gone shows the gone notice, not the refusal text', async () => {
  renderGroup(
    serving(async (url, init) => {
      if (url === '/expense-categories/1' && init?.method === 'DELETE') {
        return jsonResponse(404, { detail: 'no category', code: 'expense_category.not_found' })
      }
      throw new Error(`unexpected ${url}`)
    }),
  )

  await screen.findByText('Packaging')
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }))

  expect(await screen.findByText(GONE_NOTICE)).toBeInTheDocument()
  expect(screen.queryByText(CANNOT_REMOVE)).not.toBeInTheDocument()
})

test('a dropped network on add shows the offline notice and keeps what was typed', async () => {
  renderGroup(
    serving(async (url, init) => {
      if (url === '/expense-categories' && init?.method === 'POST') throw new TypeError('Failed to fetch')
      throw new Error(`unexpected ${url}`)
    }),
  )

  await screen.findByText('Packaging')
  await userEvent.type(screen.getByLabelText('New category'), 'Insumos')
  await userEvent.click(screen.getByRole('button', { name: '+ Category' }))

  expect(await screen.findByText(SIN_CONEXION_MENSAJE)).toBeInTheDocument()
  expect(screen.getByLabelText('New category')).toHaveValue('Insumos')
})

test('an untouched group closes at once, and so does one whose rename was opened and left as it was', async () => {
  renderGroup(serving())
  await screen.findByText('Packaging')
  await userEvent.click(screen.getByRole('button', { name: 'Rename' }))

  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  expect(await screen.findByText('Lista de grupos')).toBeInTheDocument()
})

test('closing with a new name typed asks first, and keeping stays on the group', async () => {
  renderGroup(serving())
  await screen.findByText('Packaging')
  await userEvent.type(screen.getByLabelText('New category'), 'Sin guardar')

  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  expect(await screen.findByText('Discard the category?')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'No, keep editing' }))
  expect(screen.getByLabelText('New category')).toHaveValue('Sin guardar')
  expect(screen.queryByText('Lista de grupos')).not.toBeInTheDocument()
})

test('closing with a rename edited and not saved asks, and discarding leaves the group', async () => {
  renderGroup(serving())
  await screen.findByText('Packaging')
  await userEvent.click(screen.getByRole('button', { name: 'Rename' }))
  await userEvent.type(screen.getByLabelText('Name of Packaging'), 's')

  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Yes, discard it' }))

  expect(await screen.findByText('Lista de grupos')).toBeInTheDocument()
})

test('after a save, "Close" closes at once even while the refetch is pending and would differ', async () => {
  let reads = 0
  renderGroup(async (url, init) => {
    if (url === '/expense-categories' && init?.method === 'POST') {
      return jsonResponse(201, { id: 2, name: 'Insumos' })
    }
    reads += 1
    // The first read answers; the refetch after the save never does.
    return reads === 1 ? jsonResponse(200, CATEGORIES) : new Promise<Response>(() => {})
  })
  await screen.findByText('Packaging')

  await userEvent.type(screen.getByLabelText('New category'), 'Insumos')
  await userEvent.click(screen.getByRole('button', { name: '+ Category' }))
  await screen.findByText('Category saved')
  expect(reads).toBeGreaterThan(1)
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  await waitFor(() => expect(screen.getByText('Lista de grupos')).toBeInTheDocument())
  expect(screen.queryByText('Discard the category?')).not.toBeInTheDocument()
})

test('a partner changing the list behind the screen does not make a clean group dirty', async () => {
  let reads = 0
  renderGroup(async (url, init) => {
    if (url === '/expense-categories' && init?.method === 'POST') {
      return jsonResponse(201, { id: 2, name: 'Insumos' })
    }
    reads += 1
    return jsonResponse(200, reads === 1 ? CATEGORIES : [{ id: 1, name: 'Renombrada por un socio' }])
  })
  await screen.findByText('Packaging')

  await userEvent.type(screen.getByLabelText('New category'), 'Insumos')
  await userEvent.click(screen.getByRole('button', { name: '+ Category' }))
  await screen.findByText('Category saved')
  await waitFor(() => expect(reads).toBeGreaterThan(1))
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  expect(await screen.findByText('Lista de grupos')).toBeInTheDocument()
})

test('with no categories the group follows the icon and text rule', async () => {
  renderGroup(async () => jsonResponse(200, []))
  await screen.findByLabelText('New category')
  expectIconAndTextRule(document.body)
})

test('"Delete" is the icon-only delete: no visible word, a 44 px control named "Delete"', async () => {
  renderGroup(serving())

  const remove = await screen.findByRole('button', { name: 'Delete' })

  expect(remove).toHaveClass('boton-icono')
  expect(remove).toHaveTextContent('')
  expect(remove.querySelector('svg')).not.toBeNull()
  expectIconAndTextRule(document.body)
})

test('"Rename" is the icon-only edit: a 44 px control named "Rename" with no visible word', async () => {
  renderGroup(serving())

  const rename = await screen.findByRole('button', { name: 'Rename' })

  expect(rename).toHaveClass('boton-icono')
  expect(rename).toHaveTextContent('')
  expect(rename.querySelector('svg')).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Close' })).toHaveClass('boton-icono')
  expect(screen.queryByText('Volver')).not.toBeInTheDocument()
  expectIconAndTextRule(document.body)
})
