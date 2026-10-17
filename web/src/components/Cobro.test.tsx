/**
 * `Cobro` at its own seam (plan, C0): it takes only a customer id and reads that
 * customer's balance itself when it opens, under its own frozen key. Fetch is
 * faked; nothing a caller knows about the amount reaches it.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SIN_CONEXION_TITULO } from './SinConexion'
import Cobro from './Cobro'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function customer(balance: number) {
  return {
    id: 1,
    name: 'Fer',
    phone: null,
    channel: null,
    vip: false,
    balance,
    owing_since: balance > 0 ? '2026-09-14' : null,
    standing: balance > 0 ? 'owes' : 'settled',
  }
}

function Harness({ onGone = () => undefined }: { onGone?: () => void }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        abrir
      </button>
      {open && (
        <Cobro
          customerId="1"
          today="2026-10-03"
          onClose={() => setOpen(false)}
          onSaved={() => setOpen(false)}
          onGone={onGone}
        />
      )}
    </>
  )
}

function renderCobro(onGone?: () => void) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <Harness onGone={onGone} />
    </QueryClientProvider>,
  )
  return queryClient
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('reads the customer\'s own balance on open: "Todo" and the amount are what the API answered', async () => {
  vi.mocked(fetch).mockImplementation((input) =>
    Promise.resolve(
      String(input) === '/customers/1' ? jsonResponse(200, customer(4000)) : jsonResponse(404, {}),
    ),
  )
  renderCobro()

  await userEvent.click(await screen.findByRole('button', { name: 'Todo: $ 4.000' }))
  expect(screen.getByLabelText('Monto')).toHaveValue('4000')
})

test('shows no amount and no "Todo" until the customer\'s balance arrives', async () => {
  let answer: (response: Response) => void = () => undefined
  vi.mocked(fetch).mockImplementation(
    () => new Promise<Response>((resolve) => (answer = resolve)),
  )
  renderCobro()

  expect(screen.getByLabelText('Monto')).toHaveValue('')
  expect(screen.queryByRole('button', { name: /^Todo/ })).not.toBeInTheDocument()

  answer(jsonResponse(200, customer(4000)))
  expect(await screen.findByRole('button', { name: 'Todo: $ 4.000' })).toBeInTheDocument()
})

test('a second open after a partner\'s payment shows the new balance, never the first read', async () => {
  let balance = 10000
  vi.mocked(fetch).mockImplementation(() => Promise.resolve(jsonResponse(200, customer(balance))))
  renderCobro()

  expect(await screen.findByRole('button', { name: 'Todo: $ 10.000' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(screen.queryByLabelText('Monto')).not.toBeInTheDocument()

  balance = 4000
  await userEvent.click(screen.getByRole('button', { name: 'abrir' }))
  expect(await screen.findByRole('button', { name: 'Todo: $ 4.000' })).toBeInTheDocument()
})

test('a customer that is gone calls onGone', async () => {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(404, { code: 'customer.not_found' }))
  const onGone = vi.fn()
  renderCobro(onGone)

  await waitFor(() => expect(onGone).toHaveBeenCalledTimes(1))
})

test('a dropped connection shows "Sin conexión" and no "Todo"', async () => {
  vi.mocked(fetch).mockRejectedValue(new TypeError('failed'))
  renderCobro()

  expect(await screen.findByText(SIN_CONEXION_TITULO)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^Todo/ })).not.toBeInTheDocument()
})

test('a refusal to save that says the customer is gone calls onGone, through the contract', async () => {
  vi.mocked(fetch).mockImplementation((input, init) => {
    if (init?.method === 'POST') {
      return Promise.resolve(jsonResponse(404, { code: 'payment.customer_not_found' }))
    }
    return Promise.resolve(String(input) === '/customers/1' ? jsonResponse(200, customer(4000)) : jsonResponse(404, {}))
  })
  const onGone = vi.fn()
  renderCobro(onGone)

  await userEvent.click(await screen.findByLabelText('Efectivo'))
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  await waitFor(() => expect(onGone).toHaveBeenCalledTimes(1))
})

test('the amount pre-filled from the balance is previewed at once, not after the typing delay', async () => {
  vi.mocked(fetch).mockImplementation((input, init) => {
    if (init?.method === 'POST') {
      return Promise.resolve(
        jsonResponse(200, {
          applied_to: [{ sale_id: 10, sale_date: '2026-09-14', amount: 4000 }],
          after: { balance: 0, owing_since: null, standing: 'settled' },
        }),
      )
    }
    return Promise.resolve(String(input) === '/customers/1' ? jsonResponse(200, customer(4000)) : jsonResponse(404, {}))
  })
  renderCobro()

  await screen.findByRole('button', { name: 'Todo: $ 4.000' })
  await waitFor(
    () =>
      expect(fetch).toHaveBeenCalledWith(
        '/customers/1/payments/preview',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ paid_on: '2026-10-03', amount: 4000 }) }),
      ),
    { timeout: 100 },
  )
})
