/**
 * `StockEntryForm` at the component seam: with a fixed variety and a fixed origin it posts
 * through the owner's route and offers no choice of origin, and it hands the owner's refusal
 * back inline instead of calling `onSaved`.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import StockEntryForm from './StockEntryForm'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const VARIETIES = [
  { id: 3, name: 'Sir Jack', current_price: null },
  { id: 4, name: 'Gelato', current_price: null },
]
const STOCK_VIEW = { total: 0, varieties: [], entries: [] }

function renderForm(onSaved: () => void) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StockEntryForm
        mode="nuevo"
        today="2026-10-03"
        fixedVarietyId={3}
        fixedOrigin="opening_stock"
        onSaved={onSaved}
      />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('with a fixed variety and origin it posts the opening stock and offers no origin choice', async () => {
  const onSaved = vi.fn()
  const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url === '/varieties') return Promise.resolve(jsonResponse(200, VARIETIES))
    if (url === '/stock') return Promise.resolve(jsonResponse(200, STOCK_VIEW))
    if (url === '/stock/entries' && init?.method === 'POST') {
      return Promise.resolve(
        jsonResponse(201, {
          id: 10,
          date: '2026-10-03',
          variety_id: 3,
          origin: 'opening_stock',
          grams: 30,
          total_cost: null,
          cost_per_gram: null,
          note: null,
        }),
      )
    }
    return Promise.resolve(jsonResponse(500, {}))
  })
  vi.stubGlobal('fetch', fetchMock)
  renderForm(onSaved)

  expect(screen.queryByText('Origen')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Compra' })).not.toBeInTheDocument()
  const select = await screen.findByLabelText('Variedad')
  expect(select).toBeDisabled()
  await screen.findByRole('option', { name: 'Sir Jack' })
  expect(select).toHaveValue('3')

  await userEvent.type(screen.getByLabelText('Gramos'), '30')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá la entrada' }))

  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  const post = fetchMock.mock.calls.find(([url]) => String(url) === '/stock/entries')
  expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({
    variety_id: 3,
    origin: 'opening_stock',
    grams: '30',
    date: '2026-10-03',
  })
})

test('the owner refuses the entry inline and the form does not report it saved', async () => {
  const onSaved = vi.fn()
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/varieties') return Promise.resolve(jsonResponse(200, VARIETIES))
      if (url === '/stock') return Promise.resolve(jsonResponse(200, STOCK_VIEW))
      if (init?.method === 'POST') {
        return Promise.resolve(jsonResponse(422, { code: 'stock.date_in_future' }))
      }
      return Promise.resolve(jsonResponse(500, {}))
    }),
  )
  renderForm(onSaved)

  await screen.findByRole('option', { name: 'Sir Jack' })
  await userEvent.type(screen.getByLabelText('Gramos'), '30')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá la entrada' }))

  expect(await screen.findByText('La fecha no puede ser futura')).toBeInTheDocument()
  expect(onSaved).not.toHaveBeenCalled()
})
