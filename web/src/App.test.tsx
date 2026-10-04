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
  await act(() => router.navigate('/'))
})

test('the public /entrar route renders Entrar without running a gated query', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  await act(() => router.navigate('/entrar'))

  render(<App />)

  expect(await screen.findByRole('main')).toHaveTextContent('apostrophe')
  expect(fetchMock).not.toHaveBeenCalled()
})

test('/ventas renders the Ventas stub under the gated shell', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      jsonResponse(200, { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }),
    ),
  )
  await act(() => router.navigate('/ventas'))

  render(<App />)

  // Scoped to `main` (shell-entries, GH-20): the gated shell now has its own
  // "Ventas" tab and fixed "Nueva venta" button alongside it, so an unscoped
  // query would match more than the stub screen's own heading.
  expect(await within(await screen.findByRole('main')).findByText('Ventas')).toBeInTheDocument()
})

test('/ventas/nueva renders the NuevaVenta stub under the gated shell', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      jsonResponse(200, { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }),
    ),
  )
  await act(() => router.navigate('/ventas/nueva'))

  render(<App />)

  expect(await screen.findByText('Nueva venta')).toBeInTheDocument()
})

test('/ventas/:id renders VentaDetalle, from the API, under the gated shell', async () => {
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
  await act(() => router.navigate('/ventas/1'))

  render(<App />)

  expect(await screen.findByText('Venta del 14/09')).toBeInTheDocument()
  expect(await screen.findByText('Flor A')).toBeInTheDocument()
})
