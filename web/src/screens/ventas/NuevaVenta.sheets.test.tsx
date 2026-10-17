/**
 * `NuevaVenta`'s sheets at the screen seam, through a real data router
 * (`createMemoryRouter` + `RouterProvider`) with `fetch` faked: Elegir cliente and Nuevo
 * cliente are history entries (ADR-0027), so the system back gesture closes only the sheet
 * and "Cerrar" is the same move. The sale's own leave guard keeps asking "¿Descartás la
 * venta?" under Cerrar's condition, and a Nuevo cliente save that resolves after the user
 * already left the sheets still sets the customer and navigates nowhere.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SheetRouterProvider, sheetDepth } from '../../components/useSheetStack'
import { CUSTOMERS, pathTo, SALES, SALE_NEW } from '../../routes'
import NuevaVenta from './NuevaVenta'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }
const ROSA = {
  id: 1,
  name: 'Rosa',
  current_price: { id: 9, effective_from: '2026-09-01', list_price: 1000, bulk_price: null, bulk_minimum: null },
}
const ANA = { id: 5, name: 'Ana', phone: '+5491100000000', vip: false }
const NUEVA = { id: 8, name: 'Luz', phone: null, vip: false }

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** The one POST /customers this test holds back, so a test can navigate before it resolves. */
let releaseCreate: (() => void) | null = null

beforeEach(() => {
  releaseCreate = null
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (method === 'GET' && path === '/varieties?on=2026-10-02') {
        return Promise.resolve(jsonResponse(200, [ROSA]))
      }
      if (method === 'GET' && path.startsWith(pathTo(CUSTOMERS))) {
        return Promise.resolve(jsonResponse(200, [ANA]))
      }
      if (method === 'POST' && path === '/customers') {
        return new Promise<Response>((resolve) => {
          releaseCreate = () => resolve(jsonResponse(201, NUEVA))
        })
      }
      return Promise.reject(new Error(`unexpected request: ${method} ${path}`))
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: SALES, element: <h1>Lista de ventas</h1> },
      { element: <Outlet context={ME} />, children: [{ path: SALE_NEW, element: <NuevaVenta /> }] },
    ],
    { initialEntries: [SALES, SALE_NEW], initialIndex: 1 },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <SheetRouterProvider router={router}>
        <RouterProvider router={router} />
      </SheetRouterProvider>
    </QueryClientProvider>,
  )
  return router
}

const back = (router: ReturnType<typeof renderForm>) => act(() => router.navigate(-1))
const askedToDiscard = () => screen.queryByRole('alertdialog', { name: '¿Descartás la venta?' })

async function typeNote(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Nota'), 'para Ana')
}

test('back with Elegir cliente open closes only the sheet, form intact, nothing asked', async () => {
  const user = userEvent.setup()
  const router = renderForm()
  await typeNote(user)

  await user.click(screen.getByRole('button', { name: 'Elegir cliente' }))
  expect(await screen.findByText('Buscar')).toBeInTheDocument()
  await back(router)

  expect(screen.queryByText('Buscar')).not.toBeInTheDocument()
  expect(askedToDiscard()).not.toBeInTheDocument()
  expect(router.state.location.pathname).toBe(SALE_NEW)
  expect(screen.getByLabelText('Nota')).toHaveValue('para Ana')
})

test('with Nuevo cliente over Elegir cliente, each back closes one level and never asks the sale question', async () => {
  const user = userEvent.setup()
  const router = renderForm()
  await typeNote(user)

  await user.click(screen.getByRole('button', { name: 'Elegir cliente' }))
  await user.click(await screen.findByRole('button', { name: 'Nuevo cliente' }))
  expect(screen.getByRole('button', { name: 'Crear cliente' })).toBeInTheDocument()

  await back(router)
  expect(screen.queryByRole('button', { name: 'Crear cliente' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Nuevo cliente' })).toBeInTheDocument()

  await back(router)
  expect(screen.queryByText('Buscar')).not.toBeInTheDocument()
  expect(askedToDiscard()).not.toBeInTheDocument()
  expect(screen.getByLabelText('Nota')).toHaveValue('para Ana')
})

test('"Cerrar" on Elegir cliente is the same move as back', async () => {
  const user = userEvent.setup()
  const router = renderForm()
  await typeNote(user)

  await user.click(screen.getByRole('button', { name: 'Elegir cliente' }))
  await user.click((await screen.findAllByRole('button', { name: 'Cerrar' })).at(-1)!)

  expect(screen.queryByText('Buscar')).not.toBeInTheDocument()
  expect(askedToDiscard()).not.toBeInTheDocument()
  expect(sheetDepth(router.state.location.state)).toBe(0)
})

test('choosing a customer closes the sheet and leaves exactly the form entry', async () => {
  const user = userEvent.setup()
  const router = renderForm()

  await user.click(await screen.findByRole('button', { name: 'Elegir cliente' }))
  await user.click(await screen.findByRole('button', { name: /Ana/ }))

  await waitFor(() => expect(screen.queryByText('Buscar')).not.toBeInTheDocument())
  expect(sheetDepth(router.state.location.state)).toBe(0)
  // A customer chosen makes the form dirty: the very next back is the form's own question.
  await back(router)
  expect(askedToDiscard()).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(SALE_NEW)
})

test.each([
  ['one back', async (router: ReturnType<typeof renderForm>) => back(router)],
  [
    'two backs',
    async (router: ReturnType<typeof renderForm>) => {
      await back(router)
      await back(router)
    },
  ],
  [
    'Cerrar',
    async () => {
      await userEvent.click(screen.getAllByRole('button', { name: 'Cerrar' }).at(-1)!)
    },
  ],
])('a Nuevo cliente save resolving after %s still sets the customer and leaves only the form', async (_name, leave) => {
  const user = userEvent.setup()
  const router = renderForm()
  await typeNote(user)

  await user.click(screen.getByRole('button', { name: 'Elegir cliente' }))
  await user.click(await screen.findByRole('button', { name: 'Nuevo cliente' }))
  await user.type(screen.getByLabelText('Nombre'), 'Luz')
  await user.click(screen.getByRole('button', { name: 'Crear cliente' }))
  await waitFor(() => expect(releaseCreate).not.toBeNull())

  await leave(router)
  await act(async () => {
    releaseCreate?.()
  })

  await waitFor(() => expect(screen.getByRole('button', { name: /Luz/ })).toBeInTheDocument())
  expect(screen.queryByText('Buscar')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Nota')).toHaveValue('para Ana')
  expect(router.state.location.pathname).toBe(SALE_NEW)
  expect(sheetDepth(router.state.location.state)).toBe(0)
  // Nothing of the sheets is left in history: the next back is the form's own question.
  await back(router)
  expect(askedToDiscard()).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(SALE_NEW)
})

test('a dirty form asks on back, asks again after "No, seguí cargando"', async () => {
  const user = userEvent.setup()
  const router = renderForm()
  await typeNote(user)

  await back(router)
  expect(askedToDiscard()).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'No, seguí cargando' }))
  expect(askedToDiscard()).not.toBeInTheDocument()
  expect(screen.getByLabelText('Nota')).toHaveValue('para Ana')

  await back(router)
  expect(askedToDiscard()).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Sí, descartala' }))
  expect(await screen.findByText('Lista de ventas')).toBeInTheDocument()
})

test('an untouched form closes at once on back', async () => {
  const router = renderForm()
  await screen.findByLabelText('Nota')

  await back(router)

  expect(await screen.findByText('Lista de ventas')).toBeInTheDocument()
  expect(askedToDiscard()).not.toBeInTheDocument()
})
