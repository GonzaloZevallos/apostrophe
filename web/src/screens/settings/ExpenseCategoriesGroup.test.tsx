/**
 * `ExpenseCategoriesGroup` at the screen seam: add, rename and remove a category, the fixed
 * refusal when removal is blocked because the category still has expenses
 * (`docs/product/expenses.md`, "Expense category"), and the form rule: "Cerrar", and the
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
import { SIN_CONEXION_TITULO } from '../../components/SinConexion'
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

  await userEvent.type(screen.getByLabelText('Nueva categoría'), 'Insumos')
  await userEvent.click(screen.getByRole('button', { name: '+ Categoría' }))

  expect(await screen.findByText('Categoría guardada')).toBeInTheDocument()
  expect(screen.getByText('Insumos')).toBeInTheDocument()
  expect(screen.getByLabelText('Nueva categoría')).toHaveValue('')
})

test('with no categories it shows an empty list and the add action', async () => {
  renderGroup(async () => jsonResponse(200, []))

  expect(await screen.findByLabelText('Nueva categoría')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '+ Categoría' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Renombrar' })).not.toBeInTheDocument()
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
  await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrala' }))

  expect(await screen.findByText(CANNOT_REMOVE)).toBeInTheDocument()
  expect(screen.getByText('Packaging')).toBeInTheDocument()
})

test('removing a category toasts "Categoría eliminada" and drops the row', async () => {
  renderGroup(
    serving(async (url, init) => {
      if (url === '/expense-categories/1' && init?.method === 'DELETE') {
        return new Response(null, { status: 204 })
      }
      throw new Error(`unexpected ${url}`)
    }),
  )

  await screen.findByText('Packaging')
  await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrala' }))

  expect(await screen.findByText('Categoría eliminada')).toBeInTheDocument()
  expect(screen.queryByText('Packaging')).not.toBeInTheDocument()
})

test('renaming a category toasts "Categoría guardada" and shows what the server answered', async () => {
  renderGroup(
    serving(async (url, init) => {
      if (url === '/expense-categories/1' && init?.method === 'PATCH') {
        return jsonResponse(200, { id: 1, name: 'Empaque' })
      }
      throw new Error(`unexpected ${url}`)
    }),
  )

  await screen.findByText('Packaging')
  await userEvent.click(screen.getByRole('button', { name: 'Renombrar' }))
  const input = screen.getByLabelText('Nombre de Packaging')
  await userEvent.clear(input)
  await userEvent.type(input, '  empaque  ')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByText('Categoría guardada')).toBeInTheDocument()
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
  await userEvent.type(screen.getByLabelText('Nueva categoría'), 'alquiler')
  await userEvent.click(screen.getByRole('button', { name: '+ Categoría' }))
  await screen.findByText('alquiler')
  // Rows are in the order of their rename buttons: alquiler, Bolsas, Packaging.
  const rename = async (index: number, current: string): Promise<void> => {
    await userEvent.click(screen.getAllByRole('button', { name: 'Renombrar' })[index] as HTMLElement)
    expect(screen.getByLabelText(`Nombre de ${current}`)).toBeInTheDocument()
  }
  await rename(2, 'Packaging')
  const input = screen.getByLabelText('Nombre de Packaging')
  await userEvent.clear(input)
  await userEvent.type(input, 'Cajas')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
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
  await userEvent.click(screen.getByRole('button', { name: 'Renombrar' }))
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  const notice = await screen.findByText(GONE_NOTICE)
  // Same floating slot the "Categoría guardada"/"Categoría eliminada" toast uses.
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
  await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrala' }))

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
  await userEvent.type(screen.getByLabelText('Nueva categoría'), 'Insumos')
  await userEvent.click(screen.getByRole('button', { name: '+ Categoría' }))

  expect(await screen.findByText(SIN_CONEXION_TITULO)).toBeInTheDocument()
  expect(screen.getByLabelText('Nueva categoría')).toHaveValue('Insumos')
})

test('an untouched group closes at once, and so does one whose rename was opened and left as it was', async () => {
  renderGroup(serving())
  await screen.findByText('Packaging')
  await userEvent.click(screen.getByRole('button', { name: 'Renombrar' }))

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('Lista de grupos')).toBeInTheDocument()
})

test('closing with a new name typed asks first, and keeping stays on the group', async () => {
  renderGroup(serving())
  await screen.findByText('Packaging')
  await userEvent.type(screen.getByLabelText('Nueva categoría'), 'Sin guardar')

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('¿Descartás la categoría?')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'No, seguí editando' }))
  expect(screen.getByLabelText('Nueva categoría')).toHaveValue('Sin guardar')
  expect(screen.queryByText('Lista de grupos')).not.toBeInTheDocument()
})

test('closing with a rename edited and not saved asks, and discarding leaves the group', async () => {
  renderGroup(serving())
  await screen.findByText('Packaging')
  await userEvent.click(screen.getByRole('button', { name: 'Renombrar' }))
  await userEvent.type(screen.getByLabelText('Nombre de Packaging'), 's')

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Sí, descartala' }))

  expect(await screen.findByText('Lista de grupos')).toBeInTheDocument()
})

test('after a save, "Cerrar" closes at once even while the refetch is pending and would differ', async () => {
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

  await userEvent.type(screen.getByLabelText('Nueva categoría'), 'Insumos')
  await userEvent.click(screen.getByRole('button', { name: '+ Categoría' }))
  await screen.findByText('Categoría guardada')
  expect(reads).toBeGreaterThan(1)
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  await waitFor(() => expect(screen.getByText('Lista de grupos')).toBeInTheDocument())
  expect(screen.queryByText('¿Descartás la categoría?')).not.toBeInTheDocument()
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

  await userEvent.type(screen.getByLabelText('Nueva categoría'), 'Insumos')
  await userEvent.click(screen.getByRole('button', { name: '+ Categoría' }))
  await screen.findByText('Categoría guardada')
  await waitFor(() => expect(reads).toBeGreaterThan(1))
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('Lista de grupos')).toBeInTheDocument()
})

test('with no categories the group follows the icon and text rule', async () => {
  renderGroup(async () => jsonResponse(200, []))
  await screen.findByLabelText('Nueva categoría')
  expectIconAndTextRule(document.body)
})

test('"Eliminar" is the icon-only delete: no visible word, a 44 px control named "Eliminar"', async () => {
  renderGroup(serving())

  const remove = await screen.findByRole('button', { name: 'Eliminar' })

  expect(remove).toHaveClass('boton-icono')
  expect(remove).toHaveTextContent('')
  expect(remove.querySelector('svg')).not.toBeNull()
  expectIconAndTextRule(document.body)
})

test('"Renombrar" is the icon-only edit: a 44 px control named "Renombrar" with no visible word', async () => {
  renderGroup(serving())

  const rename = await screen.findByRole('button', { name: 'Renombrar' })

  expect(rename).toHaveClass('boton-icono')
  expect(rename).toHaveTextContent('')
  expect(rename.querySelector('svg')).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveClass('boton-icono')
  expect(screen.queryByText('Volver')).not.toBeInTheDocument()
  expectIconAndTextRule(document.body)
})
