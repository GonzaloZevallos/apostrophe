/**
 * `Loading` in every screen body that rendered blank while its query waits
 * (`Estados`, "Cargando"): each screen is rendered with `fetch` held pending, so
 * its query never settles, and the skeleton must stand where the content will go.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import {
  createMemoryRouter,
  MemoryRouter,
  Outlet,
  Route,
  RouterProvider,
  Routes,
} from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Me } from '../api/me'
import FlashProvider from '../flash/FlashProvider'
import { SheetRouterProvider } from '../components/useSheetStack'
import Root from '../Root'
import ClienteFicha from './clientes/ClienteFicha'
import ClienteForm from './clientes/ClienteForm'
import TeDeben from './clientes/TeDeben'
import EntradaStock from './EntradaStock'
import Gastos from './Gastos'
import BusinessGroup from './settings/BusinessGroup'
import CatalogMessageGroup from './settings/CatalogMessageGroup'
import ExpenseCategoriesGroup from './settings/ExpenseCategoriesGroup'
import IntegrationsGroup from './settings/IntegrationsGroup'
import UsersGroup from './settings/UsersGroup'
import Variedades from './Variedades'
import Ventas from './ventas/Ventas'
import VentaDetalle from './ventas/VentaDetalle'

const ME: Me = { email: 'a@b.com', business_name: 'Negocio', today: '2026-10-03' }

// The gated layout's providers: a screen may raise a flash (`GatedLayout`).
function Context() {
  return (
    <FlashProvider>
      <Outlet context={ME} />
    </FlashProvider>
  )
}

function renderPending(element: ReactElement, route: string, path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route element={<Root />}>
            <Route element={<Context />}>
              <Route path={path} element={element} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Configuración's groups guard leaving with `useBlocker`, which needs a data router; so does
 * a screen whose sheets live in history (`VentaDetalle`, ADR-0027), with the router's handle
 * given to the sheet stack. */
function renderPendingInDataRouter(element: ReactElement, path: string, route: string = path) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [{ element: <Root />, children: [{ element: <Context />, children: [{ path, element }] }] }],
    { initialEntries: [route] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <SheetRouterProvider router={router}>
        <RouterProvider router={router} />
      </SheetRouterProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => undefined)),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

interface Case {
  name: string
  element: () => ReactElement
  route: string
  path: string
  dataRouter?: true
}

const SCREENS: Case[] = [
  { name: 'Ventas', element: () => <Ventas />, route: '/ventas', path: '/ventas' },
  { name: 'TeDeben', element: () => <TeDeben />, route: '/clientes/deben', path: '/clientes/deben' },
  { name: 'ClienteFicha', element: () => <ClienteFicha />, route: '/clientes/7', path: '/clientes/:id' },
  {
    name: 'ClienteForm editing',
    element: () => <ClienteForm mode="editar" />,
    route: '/clientes/7/editar',
    path: '/clientes/:id/editar',
  },
  {
    name: 'VentaDetalle',
    element: () => <VentaDetalle />,
    route: '/ventas/9',
    path: '/ventas/:id',
    dataRouter: true,
  },
  { name: 'Gastos', element: () => <Gastos />, route: '/gastos', path: '/gastos' },
  { name: 'Variedades', element: () => <Variedades />, route: '/varieties', path: '/varieties' },
  {
    name: 'EntradaStock editing',
    element: () => <EntradaStock mode="editar" />,
    route: '/varieties/entries/4',
    path: '/varieties/entries/:id',
  },
]

test.each(SCREENS)('$name shows the skeleton while its query is pending', async (screenCase) => {
  if (screenCase.dataRouter === true) {
    renderPendingInDataRouter(screenCase.element(), screenCase.path, screenCase.route)
  } else {
    renderPending(screenCase.element(), screenCase.route, screenCase.path)
  }

  expect(await screen.findByRole('progressbar', { name: 'Cargando' })).toBeInTheDocument()
})

const SETTINGS_GROUPS: { name: string; element: () => ReactElement; path: string }[] = [
  { name: 'BusinessGroup', element: () => <BusinessGroup />, path: '/settings/business' },
  { name: 'UsersGroup', element: () => <UsersGroup />, path: '/settings/users' },
  { name: 'IntegrationsGroup', element: () => <IntegrationsGroup />, path: '/settings/integrations' },
  {
    name: 'CatalogMessageGroup',
    element: () => <CatalogMessageGroup />,
    path: '/settings/catalog-message',
  },
  {
    name: 'ExpenseCategoriesGroup',
    element: () => <ExpenseCategoriesGroup />,
    path: '/settings/expense-categories',
  },
]

test.each(SETTINGS_GROUPS)('$name shows the skeleton while its query is pending', async (group) => {
  renderPendingInDataRouter(group.element(), group.path)

  expect(await screen.findByRole('progressbar', { name: 'Cargando' })).toBeInTheDocument()
})

test('a screen opened offline shows the skeleton under the offline banner, without throwing', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  renderPending(<Ventas />, '/ventas', '/ventas')

  expect(await screen.findByRole('progressbar', { name: 'Cargando' })).toBeInTheDocument()
  expect(screen.getByText('Te quedaste sin internet')).toBeInTheDocument()
})

test('the skeleton gives way to the content once the query settles', async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }),
  )
  renderPending(<Ventas />, '/ventas', '/ventas')

  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument())
})
