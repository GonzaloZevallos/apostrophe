/**
 * `StockEntryForm` at the component seam: with a fixed variety and a fixed origin it names the
 * variety, shows the origin as a static chip, asks only grams and the optional cost, posts
 * through the owner's route, and hands the owner's refusal back inline instead of calling
 * `onSaved`. Without them it is the owner's whole form. The types accept the locked props
 * only on a new entry with no starting entry.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import type { StockEntry } from '../api/stock'
import StockEntryForm, { type StockEntryFormProps } from './StockEntryForm'

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

  // The step's title already says it is opening stock, so no "Origen" label is drawn over the
  // static chip: not a button, not a radio, no other origin.
  const chip = screen.getByText('Stock inicial')
  expect(screen.queryByText('Origen')).not.toBeInTheDocument()
  expect(chip.closest('button')).toBeNull()
  expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Compra' })).not.toBeInTheDocument()
  // The variety is named, not chosen.
  expect(await screen.findByText('Sir Jack')).toBeInTheDocument()
  expect(screen.queryByLabelText('Variedad')).not.toBeInTheDocument()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()

  await userEvent.type(screen.getByLabelText('Gramos'), '30')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá la entrada' }))

  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  const post = fetchMock.mock.calls.find(([url]) => String(url) === '/stock/entries')
  // The date is the `today` prop, with no field for it; no note, and no cost when none is typed.
  expect(JSON.parse(String(post?.[1]?.body))).toEqual({
    variety_id: 3,
    origin: 'opening_stock',
    grams: '30',
    date: '2026-10-03',
  })
})

test('the locked form asks only for grams and the optional cost, and the no-cost line sits in the cost field', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/varieties') return Promise.resolve(jsonResponse(200, VARIETIES))
      if (url === '/stock') return Promise.resolve(jsonResponse(200, STOCK_VIEW))
      return Promise.resolve(jsonResponse(500, {}))
    }),
  )
  renderForm(vi.fn())

  await screen.findByText('Sir Jack')
  expect(screen.queryByLabelText('Fecha')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Nota')).not.toBeInTheDocument()
  expect(screen.getAllByRole('textbox').map((box) => box.closest('label')?.textContent)).toEqual([
    expect.stringContaining('Gramos'),
    expect.stringContaining('Costo total'),
  ])
  const costField = screen.getByLabelText(/^Costo total/).closest('label')
  expect(costField).toHaveTextContent('Opcional · si no lo cargás, el lote cuesta $ 0')
  expect(screen.queryByText('Obligatorio cuando es una compra')).not.toBeInTheDocument()
})

test('with a cost typed, the locked form posts it', async () => {
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

  await screen.findByText('Sir Jack')
  await userEvent.type(screen.getByLabelText('Gramos'), '30')
  await userEvent.type(screen.getByLabelText(/^Costo total/), '9000')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá la entrada' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
  expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ total_cost: 9000 })
})

test('without the locked props the form is the owner\'s whole form', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/varieties') return Promise.resolve(jsonResponse(200, VARIETIES))
      if (url === '/stock') return Promise.resolve(jsonResponse(200, STOCK_VIEW))
      return Promise.resolve(jsonResponse(500, {}))
    }),
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StockEntryForm mode="nuevo" today="2026-10-03" onSaved={vi.fn()} />
    </QueryClientProvider>,
  )

  expect(await screen.findByLabelText('Fecha')).toHaveValue('2026-10-03')
  expect(screen.getByLabelText('Variedad')).toBeEnabled()
  expect(screen.getByLabelText('Nota')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Compra' })).toBeInTheDocument()
  expect(screen.getByText('Obligatorio cuando es una compra')).toBeInTheDocument()
})

// The locked props are accepted only on a new entry with no starting entry: these are the
// shapes tsc must reject (a type that is `true` only when the props do not accept them).
type Rejected<Shape> = Shape extends StockEntryFormProps ? false : true
const base = { today: '2026-10-03', onSaved: () => undefined }
type LockedEdit = Rejected<typeof base & { mode: 'editar'; fixedVarietyId: number; fixedOrigin: 'opening_stock' }>
type LockedWithInitial = Rejected<
  typeof base & { mode: 'nuevo'; initial: StockEntry; fixedVarietyId: number; fixedOrigin: 'opening_stock' }
>
type LockedNew = Rejected<typeof base & { mode: 'nuevo'; fixedVarietyId: number; fixedOrigin: 'opening_stock' }>

test('the types reject a locked edit and a locked new entry with an initial one', () => {
  const lockedEditRejected: LockedEdit = true
  const lockedInitialRejected: LockedWithInitial = true
  const lockedNewAccepted: LockedNew = false
  expect([lockedEditRejected, lockedInitialRejected, lockedNewAccepted]).toEqual([true, true, false])
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

  await screen.findByText('Sir Jack')
  await userEvent.type(screen.getByLabelText('Gramos'), '30')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá la entrada' }))

  expect(await screen.findByText('La fecha no puede ser futura')).toBeInTheDocument()
  expect(onSaved).not.toHaveBeenCalled()
})
