/**
 * `App`'s route table at the module seam (plan, "Session"; "Shape"; invariants):
 * the public branch never mounts a gated query (/entrar draws no `fetch` at
 * all), and the gated branch's /ventas routes resolve to the screens behind
 * them — /ventas and `/ventas/:id` now the real `Ventas`/`VentaDetalle`
 * (`sales-list-and-detail`), /ventas/nueva still the stub `new-sale-screen`
 * fills in next. `router.navigate` drives the shared `router` singleton to the
 * path under test, rather than `window.history.pushState`, which would race this
 * module's own import (the router is built once, from whatever `window.location`
 * is at that moment).
 */

import { EXPENSES, HOME, LOGIN, MORE, SALE, SALES, SALE_NEW, pathTo } from './routes'
import { act, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import SALE_DETAIL from './api/fixtures/sale-detail.json'
import App from './App'
import { queryClient } from './queryClient'
import { router } from './router'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(async () => {
  vi.unstubAllGlobals()
  queryClient.clear()
  await act(() => router.navigate(HOME))
})

test('the public /entrar route renders Entrar without running a gated query', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  await act(() => router.navigate(LOGIN))

  render(<App />)

  expect(await screen.findByRole('main')).toHaveTextContent('apostrophe')
  expect(fetchMock).not.toHaveBeenCalled()
})

test('the sales list renders the Ventas stub under the gated shell', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      jsonResponse(200, { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }),
    ),
  )
  await act(() => router.navigate(SALES))

  render(<App />)

  // Scoped to `main` (shell-entries, GH-20): the gated shell now has its own
  // "Sales" tab and fixed "New sale" button alongside it, so an unscoped
  // query would match more than the stub screen's own heading.
  expect(await within(await screen.findByRole('main')).findByText('Sales')).toBeInTheDocument()
})

test('the new sale form renders the NuevaVenta stub under the gated shell', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      jsonResponse(200, { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }),
    ),
  )
  await act(() => router.navigate(SALE_NEW))

  render(<App />)

  expect(await screen.findByText('New sale')).toBeInTheDocument()
})

test('a sale detail renders VentaDetalle, from the API, under the gated shell', async () => {
  // A dedicated response per call (never one `Response` instance shared across
  // `/auth/me` and `/sales/1`): `Response.json()` can only run once per instance,
  // and this route now makes both calls, unlike the stub it replaces.
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const path = String(input)
      if (path === '/sales/1') {
        return Promise.resolve(jsonResponse(200, { ...SALE_DETAIL, id: 1 }))
      }
      return Promise.resolve(
        jsonResponse(200, { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }),
      )
    }),
  )
  await act(() => router.navigate(pathTo(SALE, { id: 1 })))

  render(<App />)

  expect(await screen.findByText('Venta del 14/09')).toBeInTheDocument()
  expect(await screen.findByText('Flor A')).toBeInTheDocument()
})

function fetchFor(view: unknown) {
  return vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const path = String(input)
    if (path.startsWith(EXPENSES)) return Promise.resolve(jsonResponse(200, view))
    if (path.startsWith('/expense-categories')) return Promise.resolve(jsonResponse(200, []))
    return Promise.resolve(
      jsonResponse(200, { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }),
    )
  })
}

test('Más renders Más under the gated shell', async () => {
  vi.stubGlobal('fetch', fetchFor({}))
  await act(() => router.navigate(MORE))

  render(<App />)

  expect(await within(await screen.findByRole('main')).findByText('More')).toBeInTheDocument()
})

test('Gastos renders Gastos, with its month, under the gated shell', async () => {
  vi.stubGlobal('fetch', fetchFor({ month: '2026-10', total: 0, categories: [] }))
  await act(() => router.navigate(EXPENSES))

  render(<App />)

  expect(
    await within(await screen.findByRole('main')).findByText(/Las compras de flores no van acá/),
  ).toBeInTheDocument()
})

test('an address the table does not mount is no front route: the catch-all sends it to Inicio', async () => {
  vi.stubGlobal('fetch', fetchFor({}))
  await act(() => router.navigate('/no-such-screen'))

  render(<App />)

  // The catch-all sends an unknown path to Inicio, never to a screen of the table (the server, not the front, redirects the old Spanish paths).
  const main = await screen.findByRole('main')
  expect(main).not.toHaveTextContent(/Las compras de flores/)
  expect(router.state.location.pathname).toBe(HOME)
})
