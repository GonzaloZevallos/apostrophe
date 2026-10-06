import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, test } from 'vitest'
import { redirectRoutes, type Redirect } from './redirects'

const FIXTURE: readonly Redirect[] = [
  { from: '/viejo', to: '/nuevo' },
  { from: '/otro-viejo', to: '/settings/algo' },
]

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      ...redirectRoutes(FIXTURE),
      { path: '/nuevo', element: <h1>Nuevo</h1> },
      { path: '/settings/algo', element: <h1>Algo</h1> },
      { path: '*', element: <h1>Inicio</h1> },
    ],
    { initialEntries: ['/', path], initialIndex: 1 },
  )
  render(<RouterProvider router={router} />)
  return router
}

test('an entry of the table turns into a replace navigation to its target', () => {
  const router = renderAt('/viejo')

  expect(router.state.location.pathname).toBe('/nuevo')
  expect(router.state.historyAction).toBe('REPLACE')
  expect(screen.getByRole('heading', { name: 'Nuevo' })).toBeInTheDocument()
})

test('every entry redirects on its own, and a path outside the table is untouched', () => {
  expect(renderAt('/otro-viejo').state.location.pathname).toBe('/settings/algo')
  expect(renderAt('/no-esta-en-la-tabla').state.location.pathname).toBe('/no-esta-en-la-tabla')
})

test('the real table sends /negocio, the old business screen, to Configuración with a replace', () => {
  const router = createMemoryRouter(
    [
      ...redirectRoutes(),
      { path: '/settings', element: <h1>Configuración</h1> },
      { path: '*', element: <h1>Inicio</h1> },
    ],
    { initialEntries: ['/mas', '/negocio'], initialIndex: 1 },
  )
  render(<RouterProvider router={router} />)

  expect(router.state.location.pathname).toBe('/settings')
  expect(router.state.historyAction).toBe('REPLACE')
  expect(screen.getByRole('heading', { name: 'Configuración' })).toBeInTheDocument()
})

test('the real table sends /gastos/categorias, the old categories screen, to Configuración → Categorías de gastos with a replace', () => {
  const router = createMemoryRouter(
    [
      ...redirectRoutes(),
      { path: '/settings/expense-categories', element: <h1>Categorías de gastos</h1> },
      { path: '*', element: <h1>Inicio</h1> },
    ],
    { initialEntries: ['/gastos', '/gastos/categorias'], initialIndex: 1 },
  )
  render(<RouterProvider router={router} />)

  expect(router.state.location.pathname).toBe('/settings/expense-categories')
  expect(router.state.historyAction).toBe('REPLACE')
  expect(screen.getByRole('heading', { name: 'Categorías de gastos' })).toBeInTheDocument()
})
