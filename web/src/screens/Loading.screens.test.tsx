/**
 * `Loading` in every screen body that rendered blank while its query waits
 * (`Estados`, "Cargando"): each screen is rendered with `fetch` held pending, so
 * its query never settles, and the skeleton must stand where the content will go.
 */

import { CUSTOMER, CUSTOMERS_OWING, CUSTOMER_EDIT, EXPENSES, EXPENSE_CATEGORIES, SALE, SALES, SETTINGS_BUSINESS, SETTINGS_CATALOG_MESSAGE, SETTINGS_INTEGRATIONS, SETTINGS_USERS, STOCK, STOCK_ENTRY, pathTo } from '../routes'
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
import Stock from './Stock'
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

/** Configuración's groups guard leaving with `useBlocker`, which needs a data router. */
function renderPendingInDataRouter(element: ReactElement, path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [{ element: <Root />, children: [{ element: <Context />, children: [{ path, element }] }] }],
    { initialEntries: [path] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
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
}

const SCREENS: Case[] = [
  { name: 'Ventas', element: () => <Ventas />, route: SALES, path: SALES },
  { name: 'TeDeben', element: () => <TeDeben />, route: CUSTOMERS_OWING, path: CUSTOMERS_OWING },
  { name: 'ClienteFicha', element: () => <ClienteFicha />, route: pathTo(CUSTOMER, { id: 7 }), path: CUSTOMER },
  {
    name: 'ClienteForm editing',
    element: () => <ClienteForm mode="editar" />,
    route: pathTo(CUSTOMER_EDIT, { id: 7 }),
    path: CUSTOMER_EDIT,
  },
  { name: 'VentaDetalle', element: () => <VentaDetalle />, route: pathTo(SALE, { id: 9 }), path: SALE },
  { name: 'Gastos', element: () => <Gastos />, route: EXPENSES, path: EXPENSES },
  { name: 'Stock', element: () => <Stock />, route: STOCK, path: STOCK },
  {
    name: 'EntradaStock editing',
    element: () => <EntradaStock mode="editar" />,
    route: pathTo(STOCK_ENTRY, { id: 4 }),
    path: STOCK_ENTRY,
  },
]

test.each(SCREENS)('$name shows the skeleton while its query is pending', async (screenCase) => {
  renderPending(screenCase.element(), screenCase.route, screenCase.path)

  expect(await screen.findByRole('progressbar', { name: 'Cargando' })).toBeInTheDocument()
})

const SETTINGS_GROUPS: { name: string; element: () => ReactElement; path: string }[] = [
  { name: 'BusinessGroup', element: () => <BusinessGroup />, path: SETTINGS_BUSINESS },
  { name: 'UsersGroup', element: () => <UsersGroup />, path: SETTINGS_USERS },
  { name: 'IntegrationsGroup', element: () => <IntegrationsGroup />, path: SETTINGS_INTEGRATIONS },
  {
    name: 'CatalogMessageGroup',
    element: () => <CatalogMessageGroup />,
    path: SETTINGS_CATALOG_MESSAGE,
  },
  {
    name: 'ExpenseCategoriesGroup',
    element: () => <ExpenseCategoriesGroup />,
    path: EXPENSE_CATEGORIES,
  },
]

test.each(SETTINGS_GROUPS)('$name shows the skeleton while its query is pending', async (group) => {
  renderPendingInDataRouter(group.element(), group.path)

  expect(await screen.findByRole('progressbar', { name: 'Cargando' })).toBeInTheDocument()
})

test('a screen opened offline shows the skeleton under the offline banner, without throwing', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  renderPending(<Ventas />, SALES, SALES)

  expect(await screen.findByRole('progressbar', { name: 'Cargando' })).toBeInTheDocument()
  expect(screen.getByText('Te quedaste sin internet')).toBeInTheDocument()
})

test('the skeleton gives way to the content once the query settles', async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }),
  )
  renderPending(<Ventas />, SALES, SALES)

  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument())
})
