/**
 * `App`'s route table at the module seam (plan, "Session"; "Shape"; invariants):
 * the public branch never mounts a gated query ("/entrar" draws no `fetch` at
 * all), and the gated branch's new `/ventas` routes resolve to the stub screens
 * this subtask registers for the screen subtasks to fill in. `router.navigate`
 * drives the shared `router` singleton to the path under test, rather than
 * `window.history.pushState`, which would race this module's own import (the
 * router is built once, from whatever `window.location` is at that moment).
 */

import { act, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
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

test('/ventas/:id renders the VentaDetalle stub under the gated shell', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      jsonResponse(200, { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }),
    ),
  )
  await act(() => router.navigate('/ventas/sale-1'))

  render(<App />)

  expect(await screen.findByText('Venta')).toBeInTheDocument()
})
