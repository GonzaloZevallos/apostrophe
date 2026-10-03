/**
 * `ClienteFicha` at the screen seam: a `gone` answer shows `GoneScreen` with
 * "Volver a Clientes", never a 403 or a hint of what the id actually is
 * (ADR-0004).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import ClienteFicha from './ClienteFicha'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderFicha(id: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/clientes/${id}`]}>
        <Routes>
          <Route path="/clientes/:id" element={<ClienteFicha />} />
          <Route path="/clientes" element={<span>la lista</span>} />
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

test('a customer that is gone shows the gone screen, with a way back to the list', async () => {
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse(404, { detail: 'no such customer', code: 'customer.not_found' }),
  )
  renderFicha('999')

  expect(await screen.findByText('Eso ya no está.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Volver a Clientes' })).toHaveAttribute(
    'href',
    '/clientes',
  )
  expect(screen.queryByText(/999/)).not.toBeInTheDocument()
})

test('a real customer shows their phone, channel and VIP, no balance', async () => {
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse(200, { id: 3, name: 'Fer', phone: '+5491158423310', channel: 'telegram', vip: true }),
  )
  renderFicha('3')

  expect(await screen.findByText('+54 9 11 5842-3310')).toBeInTheDocument()
  expect(screen.getByText('Telegram')).toBeInTheDocument()
  expect(screen.queryByText(/te debe/i)).not.toBeInTheDocument()
})
