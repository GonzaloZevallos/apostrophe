/**
 * Step 2 at the component seam (Testing Library, `fetch` faked): the owner's stock form as an
 * initial stock of the API's `stock_target` — the variety named, the Stock inicial chip, the
 * $ 0 hint on the cost field, no date, variety select or note, and nothing under the button —
 * and the post that goes to the owner's route.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import type { OnboardingProgress } from '../../api/onboarding'
import StockStep from './StockStep'

const ME = { email: 'ana@x.com', business_name: 'La Huerta', today: '2026-10-03' }
const PROGRESS: OnboardingProgress = {
  offered: true,
  over: false,
  count: 1,
  resume: 'stock',
  steps: [
    { step: 'variety', state: 'done' },
    { step: 'stock', state: 'pending' },
    { step: 'header_footer', state: 'pending' },
    { step: 'bot', state: 'pending' },
    { step: 'partner', state: 'pending' },
    { step: 'categories', state: 'pending' },
  ],
  can_skip_rest: false,
  varieties_count: 1,
  stock_entries_count: 0,
  price_target: null,
  stock_target: { id: 7, name: 'Mango Bomb' },
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function stub(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`
    if (key === 'GET /varieties') return Promise.resolve(json([{ id: 7, name: 'Mango Bomb', current_price: null }]))
    if (key === 'GET /stock') return Promise.resolve(json({ total: 0, varieties: [], entries: [] }))
    if (key === 'POST /stock/entries') return Promise.resolve(json({}, 201))
    if (key === 'GET /onboarding-progress') return Promise.resolve(json(PROGRESS))
    return Promise.resolve(json({}, 404))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderStep(): void {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <StockStep me={ME} progress={PROGRESS} onDirtyChange={() => undefined} onProgress={() => undefined} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('names the variety, draws the Stock inicial chip and the $ 0 hint on the cost, with only grams and cost to fill', () => {
  stub()
  renderStep()

  expect(screen.getByText('Mango Bomb')).toBeInTheDocument()
  expect(screen.getByText('Hoy 03/10')).toBeInTheDocument()
  expect(screen.getByText('Stock inicial')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Stock inicial' })).not.toBeInTheDocument()
  expect(screen.getByText('Opcional · si no lo cargás, el lote cuesta $ 0')).toBeInTheDocument()
  expect(screen.queryByLabelText('Fecha')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Nota')).not.toBeInTheDocument()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Gramos')).toBeInTheDocument()
  expect(screen.getByLabelText(/^Costo total/)).toBeInTheDocument()
})

test('says under the variety that it has no stock yet', async () => {
  stub()
  renderStep()

  expect(await screen.findByText('Todavía no tiene stock')).toBeInTheDocument()
})

test('leaves no line about the cost under the button and no "Variedad: …" line', () => {
  stub()
  renderStep()

  expect(screen.queryByText('Si no cargás el costo, el lote cuesta $ 0.')).not.toBeInTheDocument()
  expect(screen.queryByText('Variedad: Mango Bomb')).not.toBeInTheDocument()
})

test('saves the opening stock of the target dated today through the owner, with the typed cost', async () => {
  const fetchMock = stub()
  renderStep()

  await userEvent.type(screen.getByLabelText('Gramos'), '500')
  await userEvent.type(screen.getByLabelText(/^Costo total/), '9000')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá el stock' }))

  expect(await screen.findByRole('button', { name: 'Agregar otra variedad' })).toBeInTheDocument()
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/stock/entries', expect.anything()))
  const post = fetchMock.mock.calls.find(([url]) => String(url) === '/stock/entries')
  expect(JSON.parse(String(post?.[1]?.body))).toEqual({
    date: '2026-10-03',
    variety_id: 7,
    origin: 'opening_stock',
    grams: '500',
    total_cost: 9000,
  })
})
