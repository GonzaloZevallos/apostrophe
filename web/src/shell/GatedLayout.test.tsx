/**
 * `GatedLayout` at the screen seam: `GET /auth/me` is the gated branch's one query
 * (plan, "Session"). A dropped network shows "Sin conexión" instead of a blank page
 * that never recovers; a server error shows the generic retry, never a refusal
 * (`accounts.md`, "No network" / "Feedback"). A successful `me` renders whatever is
 * nested under it.
 */

import { HOME } from '../routes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { SIN_CONEXION_MENSAJE } from '../components/estadosMessages'
import { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import GatedLayout from './GatedLayout'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderGated() {
  // `retry: false`: a failed `me` must settle into `isError` on the first try, not
  // after react-query's default exponential-backoff retries — the state under test.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[HOME]}>
        <Routes>
          <Route element={<GatedLayout />}>
            <Route index element={<div>contenido del negocio</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('a dropped network on GET /auth/me shows "Sin conexión", not a blank page', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

  renderGated()

  expect(await screen.findByText(SIN_CONEXION_MENSAJE)).toBeInTheDocument()
  expect(screen.queryByText('contenido del negocio')).not.toBeInTheDocument()
})

test('a server error on GET /auth/me shows the generic retry, not a blank page', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('internal error', { status: 500 })))

  renderGated()

  expect(await screen.findByText(ERROR_GENERICO_MENSAJE)).toBeInTheDocument()
  expect(screen.queryByText('contenido del negocio')).not.toBeInTheDocument()
})

test('a successful "me" renders what is nested under the gated layout', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      jsonResponse(200, { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-02' }),
    ),
  )

  renderGated()

  expect(await screen.findByText('contenido del negocio')).toBeInTheDocument()
})
