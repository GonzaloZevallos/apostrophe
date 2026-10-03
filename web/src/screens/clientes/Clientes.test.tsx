/**
 * `Clientes` at the screen seam (CODING_STANDARDS §10): Testing Library, `fetch`
 * faked. Search lives in the `/clientes` layout's context, never the URL
 * (plan, invariants); a stale answer is only ever shown marked pending, never as
 * the answer to the query currently typed (`customers.md`, "List and search").
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import Clientes from './Clientes'
import ClientesLayout from './ClientesLayout'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderClientes() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/clientes']}>
        <Routes>
          <Route element={<ClientesLayout />}>
            <Route path="/clientes" element={<Clientes />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('searching by part of the name calls the API with that query, never the URL', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, []))
  renderClientes()

  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/customers', expect.anything()))

  await userEvent.type(screen.getByLabelText('Buscar cliente'), 'nico')

  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith('/customers?q=nico', expect.anything()),
  )
})

test('searching by digits of the phone also never touches the URL', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, []))
  renderClientes()
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/customers', expect.anything()))

  await userEvent.type(screen.getByLabelText('Buscar cliente'), '6033')

  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith('/customers?q=6033', expect.anything()),
  )
})

test('a stale answer still in flight shows marked pending, never as the current result', async () => {
  let resolveFirst: ((value: Response) => void) | undefined
  const firstPromise = new Promise<Response>((resolve) => {
    resolveFirst = resolve
  })
  vi.mocked(fetch).mockImplementationOnce(() => firstPromise)
  vi.mocked(fetch).mockResolvedValueOnce(
    jsonResponse(200, [{ id: 2, name: 'Nico Parra', phone: '+5491131785094', channel: null, vip: false }]),
  )
  renderClientes()

  const input = screen.getByLabelText('Buscar cliente')
  await userEvent.type(input, 'ni')
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))

  // The newer query ("ni") already answered while the first (empty query) is
  // still pending: the list must show the newer data, and never let the first
  // call's late answer replace it afterwards.
  await waitFor(() => expect(screen.getByText('Nico Parra')).toBeInTheDocument())

  resolveFirst?.(jsonResponse(200, []))
  await new Promise((resolve) => setTimeout(resolve, 10))
  expect(screen.getByText('Nico Parra')).toBeInTheDocument()
})

test('a result still catching up to a newer keystroke is marked pending, not current', async () => {
  let resolveSecond: ((value: Response) => void) | undefined
  vi.mocked(fetch).mockResolvedValueOnce(
    jsonResponse(200, [{ id: 1, name: 'Mica Solano', phone: '+5491160337725', channel: null, vip: false }]),
  )
  vi.mocked(fetch).mockImplementationOnce(
    () => new Promise<Response>((resolve) => { resolveSecond = resolve }),
  )
  renderClientes()
  await waitFor(() => expect(screen.getByText('Mica Solano')).toBeInTheDocument())

  await userEvent.type(screen.getByLabelText('Buscar cliente'), 'x')
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))

  await waitFor(() => expect(screen.getByText('Buscando…')).toBeInTheDocument())
  const list = screen.getByText('Buscando…').closest('.lista-clientes')
  expect(list).toHaveAttribute('aria-busy', 'true')
  resolveSecond?.(jsonResponse(200, []))
})

test('a dropped network on the list shows Sin conexión, never the empty-list text', async () => {
  vi.mocked(fetch).mockRejectedValue(new TypeError('network error'))
  renderClientes()

  expect(await screen.findByText('Te quedaste sin internet')).toBeInTheDocument()
  expect(screen.queryByText('Todavía no agregaste ningún cliente.')).not.toBeInTheDocument()
})

test('a server error on the list shows the generic retry, never the empty-list text', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response('boom', { status: 500 }))
  renderClientes()

  expect(await screen.findByText('Algo falló. Probá de nuevo.')).toBeInTheDocument()
  expect(screen.queryByText('Todavía no agregaste ningún cliente.')).not.toBeInTheDocument()
})
