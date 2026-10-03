/**
 * `ClienteFicha` at the screen seam: a `gone` answer shows `GoneScreen` with
 * "Volver a Clientes", never a 403 or a hint of what the id actually is
 * (ADR-0004). "Nueva venta a <name>" (customers.md, "On screen (Clientes)")
 * opens the sale form with this customer chosen through `newSaleFor`, the state's
 * only writer (plan, invariants) — never the customer's name, which rides only in
 * the link's own visible text.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { readNewSaleState } from '../../components/feedback'
import ClienteFicha from './ClienteFicha'

function NuevaVentaStub() {
  const location = useLocation()
  const customerId = readNewSaleState(location.state)
  return <span>Nueva venta para {customerId ?? 'nadie'}</span>
}

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
          <Route path="/ventas/nueva" element={<NuevaVentaStub />} />
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

test('"Nueva venta a <name>" opens the sale form with this customer chosen, by id alone', async () => {
  vi.mocked(fetch).mockResolvedValue(
    jsonResponse(200, { id: 3, name: 'Fer', phone: '+5491158423310', channel: 'telegram', vip: true }),
  )
  renderFicha('3')

  const link = await screen.findByRole('link', { name: 'Nueva venta a Fer' })
  expect(link).toHaveAttribute('href', '/ventas/nueva')
  await userEvent.click(link)

  expect(await screen.findByText('Nueva venta para 3')).toBeInTheDocument()
})
