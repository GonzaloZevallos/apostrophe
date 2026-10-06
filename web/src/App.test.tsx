/**
 * `App`'s route table at the module seam (plan, "Session"; "Shape"; invariants):
 * the public branch never mounts a gated query ("/entrar" draws no `fetch` at
 * all), and the gated branch's `/ventas` routes resolve to the screens behind
 * them — `/ventas` and `/ventas/:id` now the real `Ventas`/`VentaDetalle`
 * (`sales-list-and-detail`), `/ventas/nueva` still the stub `new-sale-screen`
 * fills in next. `router.navigate` drives the shared `router` singleton to the
 * path under test, rather than `window.history.pushState`, which would race this
 * module's own import (the router is built once, from whatever `window.location`
 * is at that moment).
 */

import { act, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import SALE_DETAIL from './api/fixtures/sale-detail.json'
import App from './App'
import { queryClient } from './queryClient'
import { router } from './router'
import { paths } from './routes/paths'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(async () => {
  vi.unstubAllGlobals()
  queryClient.clear()
  await act(() => router.navigate(paths.home()))
})

test('the public login route renders Entrar without running a gated query', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  await act(() => router.navigate(paths.login()))

  render(<App />)

  expect(await screen.findByRole('main')).toHaveTextContent('apostrophe')
  expect(fetchMock).not.toHaveBeenCalled()
})

test('the sales route renders the Ventas stub under the gated shell', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      jsonResponse(200, { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }),
    ),
  )
  await act(() => router.navigate(paths.sales()))

  render(<App />)

  // Scoped to `main` (shell-entries, GH-20): the gated shell now has its own
  // "Ventas" tab and fixed "Nueva venta" button alongside it, so an unscoped
  // query would match more than the stub screen's own heading.
  expect(await within(await screen.findByRole('main')).findByText('Ventas')).toBeInTheDocument()
})

test('the new-sale route renders the NuevaVenta stub under the gated shell', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      jsonResponse(200, { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }),
    ),
  )
  await act(() => router.navigate(paths.newSale()))

  render(<App />)

  expect(await screen.findByText('Nueva venta')).toBeInTheDocument()
})

test('the sale-detail route renders VentaDetalle, from the API, under the gated shell', async () => {
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
  await act(() => router.navigate(paths.sale(1)))

  render(<App />)

  expect(await screen.findByText('Venta del 14/09')).toBeInTheDocument()
  expect(await screen.findByText('Flor A')).toBeInTheDocument()
})

test('a 401 on the first gated call lands on the login path and leaves no history entry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { detail: 'no', code: 'unknown' })))
  await act(() => router.navigate(paths.sales()))
  const entriesBefore = window.history.length

  render(<App />)

  await waitFor(() => expect(router.state.location.pathname).toBe(paths.login()))
  expect(router.state.historyAction).toBe('REPLACE')
  expect(window.history.length).toBe(entriesBefore)
})
