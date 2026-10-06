/**
 * The route table at the router seam (createMemoryRouter over the exported routes): the
 * interim routes render what exists today, so their area issues only replace a row, and
 * the paths with no screen do not exist.
 */

import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { queryClient } from './queryClient'
import { routes } from './router'
import { paths } from './routes/paths'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }

function open(path: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(
        new Response(JSON.stringify(url === '/auth/me' ? ME : { code: 'x' }), {
          status: url === '/auth/me' ? 200 : 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    ),
  )
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

afterEach(() => {
  vi.unstubAllGlobals()
  queryClient.clear()
})

test.each([paths.catalog(), paths.settingsIntegrations(), paths.settingsCatalogMessage()])(
  '%s renders the catalog screen',
  async (path) => {
    open(path)
    expect(await screen.findByText('Catálogo')).toBeInTheDocument()
  },
)

test('/customers/owing renders today\'s Te deben screen', async () => {
  open(paths.customersOwing())
  expect(await screen.findByText('Te deben')).toBeInTheDocument()
})

test('/settings lists exactly the four groups, with no entry for the interim routes', async () => {
  open(paths.settings())
  const list = await screen.findByRole('navigation', { name: 'Configuración' })
  expect(within(list).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
    paths.settingsBusiness(),
    paths.settingsUsers(),
    paths.settingsAccount(),
    paths.expenseCategories(),
  ])
})

test('an unknown path, Apariencia included, goes to Inicio', async () => {
  const router = open(`${paths.settings()}/appearance`)
  await waitFor(() => expect(router.state.location.pathname).toBe(paths.home()))
})
