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

function Context() {
  return <Outlet context={ME} />
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

const SCREENS: [string, ReactElement, string, string][] = [
  ['Ventas', <Ventas />, '/ventas', '/ventas'],
  ['TeDeben', <TeDeben />, '/clientes/deben', '/clientes/deben'],
  ['ClienteFicha', <ClienteFicha />, '/clientes/7', '/clientes/:id'],
  ['ClienteForm editing', <ClienteForm mode="editar" />, '/clientes/7/editar', '/clientes/:id/editar'],
  ['VentaDetalle', <VentaDetalle />, '/ventas/9', '/ventas/:id'],
  ['Gastos', <Gastos />, '/gastos', '/gastos'],
  ['GastoCategorias', <GastoCategorias />, '/gastos/categorias', '/gastos/categorias'],
  ['Negocio', <Negocio />, '/negocio', '/negocio'],
  ['Stock', <Stock />, '/mi-stock', '/mi-stock'],
  ['EntradaStock editing', <EntradaStock mode="editar" />, '/mi-stock/entradas/4', '/mi-stock/entradas/:id'],
]

test.each(SCREENS)('%s shows the skeleton while its query is pending', async (_name, element, route, path) => {
  renderPending(element, route, path)

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
