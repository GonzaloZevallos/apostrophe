/**
 * `Loading` in every screen body that rendered blank while its query waits
 * (`Estados`, "Cargando"): each screen is rendered with `fetch` held pending, so
 * its query never settles, and the skeleton must stand where the content will go.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Me } from '../api/me'
import FlashProvider from '../flash/FlashProvider'
import Root from '../Root'
import ClienteFicha from './clientes/ClienteFicha'
import ClienteForm from './clientes/ClienteForm'
import TeDeben from './clientes/TeDeben'
import EntradaStock from './EntradaStock'
import GastoCategorias from './GastoCategorias'
import Gastos from './Gastos'
import Negocio from './Negocio'
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
  { name: 'Ventas', element: () => <Ventas />, route: '/ventas', path: '/ventas' },
  { name: 'TeDeben', element: () => <TeDeben />, route: '/clientes/deben', path: '/clientes/deben' },
  { name: 'ClienteFicha', element: () => <ClienteFicha />, route: '/clientes/7', path: '/clientes/:id' },
  {
    name: 'ClienteForm editing',
    element: () => <ClienteForm mode="editar" />,
    route: '/clientes/7/editar',
    path: '/clientes/:id/editar',
  },
  { name: 'VentaDetalle', element: () => <VentaDetalle />, route: '/ventas/9', path: '/ventas/:id' },
  { name: 'Gastos', element: () => <Gastos />, route: '/gastos', path: '/gastos' },
  {
    name: 'GastoCategorias',
    element: () => <GastoCategorias />,
    route: '/gastos/categorias',
    path: '/gastos/categorias',
  },
  { name: 'Negocio', element: () => <Negocio />, route: '/negocio', path: '/negocio' },
  { name: 'Stock', element: () => <Stock />, route: '/mi-stock', path: '/mi-stock' },
  {
    name: 'EntradaStock editing',
    element: () => <EntradaStock mode="editar" />,
    route: '/mi-stock/entradas/4',
    path: '/mi-stock/entradas/:id',
  },
]

test.each(SCREENS)('$name shows the skeleton while its query is pending', async (screenCase) => {
  renderPending(screenCase.element(), screenCase.route, screenCase.path)

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
