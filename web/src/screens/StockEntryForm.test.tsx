/**
 * `StockEntryForm` at the component seam: as an initial-stock entry (`initialStock`) it names
 * the variety, draws the origin as a fixed chip, offers no date, variety or note control, posts
 * through the owner's route and hands the owner's refusal back inline instead of calling
 * `onSaved`.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import StockEntryForm, { DATE_IN_FUTURE } from './StockEntryForm'
import { COST_REQUIRED_HELP, NO_COST_HELP } from './stockMessages'

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
        initialStock={{ variety: { id: 3, name: 'Sir Jack' } }}
        onSaved={onSaved}
      />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('as an initial stock it posts the opening stock and offers no origin choice', async () => {
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
  // The variety is locked: named, with nothing to choose from.
  expect(screen.getByText('Sir Jack')).toBeInTheDocument()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()

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

  await userEvent.type(screen.getByLabelText('Gramos'), '30')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá la entrada' }))

  expect(await screen.findByText('La fecha no puede ser futura')).toBeInTheDocument()
  expect(onSaved).not.toHaveBeenCalled()
})

test('as an initial stock it draws the chip and the $ 0 hint, and no date, variety or note control', () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/varieties') return Promise.resolve(jsonResponse(200, VARIETIES))
      return Promise.resolve(jsonResponse(200, STOCK_VIEW))
    }),
  )
  renderForm(vi.fn())

  expect(screen.getByText('Stock inicial')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Stock inicial' })).not.toBeInTheDocument()
  expect(screen.getByText(NO_COST_HELP)).toBeInTheDocument()
  expect(screen.queryByText(COST_REQUIRED_HELP)).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Fecha')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Nota')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Variedad')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Gramos')).toBeInTheDocument()
  expect(screen.getByLabelText(/^Costo total/)).toBeInTheDocument()
})

test('as an initial stock the post carries opening_stock, the today prop and no note', async () => {
  const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url === '/varieties') return Promise.resolve(jsonResponse(200, VARIETIES))
    if (url === '/stock') return Promise.resolve(jsonResponse(200, STOCK_VIEW))
    if (init?.method === 'POST') return Promise.resolve(jsonResponse(201, {}))
    return Promise.resolve(jsonResponse(500, {}))
  })
  vi.stubGlobal('fetch', fetchMock)
  const onSaved = vi.fn()
  renderForm(onSaved)

  await userEvent.type(screen.getByLabelText('Gramos'), '12,5')
  await userEvent.type(screen.getByLabelText(/^Costo total/), '4000')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá la entrada' }))

  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  const post = fetchMock.mock.calls.find(([url]) => String(url) === '/stock/entries')
  const body: unknown = JSON.parse(String(post?.[1]?.body))
  expect(body).toEqual({
    date: '2026-10-03',
    variety_id: 3,
    origin: 'opening_stock',
    grams: '12.5',
    total_cost: 4000,
  })
})

test('as an initial stock a date_in_future refusal shows in the form alert and keeps the typed grams and cost', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/varieties') return Promise.resolve(jsonResponse(200, VARIETIES))
      if (url === '/stock') return Promise.resolve(jsonResponse(200, STOCK_VIEW))
      if (init?.method === 'POST') return Promise.resolve(jsonResponse(422, { code: 'stock.date_in_future' }))
      return Promise.resolve(jsonResponse(500, {}))
    }),
  )
  const onSaved = vi.fn()
  renderForm(onSaved)

  await userEvent.type(screen.getByLabelText('Gramos'), '30')
  await userEvent.type(screen.getByLabelText(/^Costo total/), '900')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá la entrada' }))

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent(DATE_IN_FUTURE)
  expect(alert).toBeVisible()
  expect(screen.getByLabelText('Gramos')).toHaveValue('30')
  expect(screen.getByLabelText(/^Costo total/)).toHaveValue('900')
  expect(onSaved).not.toHaveBeenCalled()
})
