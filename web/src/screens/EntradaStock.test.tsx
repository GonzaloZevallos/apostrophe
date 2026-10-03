/**
 * `EntradaStock` at the screen seam (`stock.md`, "Nueva entrada" and "Editing an
 * entry"): records a new entry, refuses a purchase with no cost on its own field,
 * confirms before saving an edit, and confirms before deleting, naming the date,
 * variety and grams.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import EntradaStock from './EntradaStock'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function ListStub() {
  const location = useLocation()
  const state = location.state as { toast?: string; notice?: string } | null
  return (
    <div>
      <span>la lista de stock</span>
      {state?.toast !== undefined && <span>{state.toast}</span>}
      {state?.notice !== undefined && <span>{state.notice}</span>}
    </div>
  )
}

function renderForm(initialPath: string) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/mi-stock/nueva-entrada" element={<EntradaStock mode="nuevo" />} />
          <Route path="/mi-stock/entradas/:id" element={<EntradaStock mode="editar" />} />
          <Route path="/mi-stock" element={<ListStub />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const VARIETIES = [{ id: 3, name: 'Sir Jack', current_price: null }]

afterEach(() => {
  vi.unstubAllGlobals()
})

test('records an entry and lands back on the list with the saved toast', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/varieties') return Promise.resolve(jsonResponse(200, VARIETIES))
      return Promise.resolve(
        jsonResponse(201, {
          id: 10,
          date: '2026-10-03',
          variety_id: 3,
          origin: 'harvest',
          grams: 30,
          total_cost: null,
          cost_per_gram: null,
          note: null,
        }),
      )
    }),
  )
  renderForm('/mi-stock/nueva-entrada')

  await userEvent.type(screen.getByLabelText('Fecha'), '2026-10-03')
  await userEvent.type(screen.getByLabelText('Gramos'), '30')
  await userEvent.selectOptions(await screen.findByLabelText('Variedad'), 'Sir Jack')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá la entrada' }))

  expect(await screen.findByText('la lista de stock')).toBeInTheDocument()
  expect(screen.getByText('Entrada guardada')).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/stock/entries', expect.objectContaining({ method: 'POST' }))
})

test('a purchase refused for missing cost shows the refusal on its own field, keeping what was typed', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/varieties') return Promise.resolve(jsonResponse(200, VARIETIES))
      return Promise.resolve(jsonResponse(422, { detail: 'needs a cost', code: 'stock.cost_required' }))
    }),
  )
  renderForm('/mi-stock/nueva-entrada')

  await userEvent.type(screen.getByLabelText('Fecha'), '2026-10-03')
  await userEvent.type(screen.getByLabelText('Gramos'), '30')
  await userEvent.selectOptions(await screen.findByLabelText('Variedad'), 'Sir Jack')
  await userEvent.click(screen.getByRole('button', { name: 'Guardá la entrada' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Una compra necesita un costo total')
  expect(screen.getByLabelText('Gramos')).toHaveValue('30')
})

test('editing an entry confirms before saving', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/varieties') return Promise.resolve(jsonResponse(200, VARIETIES))
      if (url === '/stock/entries/10') {
        return Promise.resolve(
          jsonResponse(200, {
            id: 10,
            date: '2026-09-20',
            variety_id: 3,
            origin: 'harvest',
            grams: 25,
            total_cost: null,
            cost_per_gram: null,
            note: null,
          }),
        )
      }
      return Promise.resolve(
        jsonResponse(200, {
          id: 10,
          date: '2026-09-20',
          variety_id: 3,
          origin: 'harvest',
          grams: 28,
          total_cost: null,
          cost_per_gram: null,
          note: null,
        }),
      )
    }),
  )
  renderForm('/mi-stock/entradas/10')

  expect(await screen.findByLabelText('Gramos')).toHaveValue('25')
  await userEvent.clear(screen.getByLabelText('Gramos'))
  await userEvent.type(screen.getByLabelText('Gramos'), '28')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByRole('alertdialog')).toHaveTextContent('¿Guardás los cambios?')
  expect(fetch).not.toHaveBeenCalledWith('/stock/entries/10', expect.objectContaining({ method: 'PUT' }))

  await userEvent.click(screen.getByRole('button', { name: 'Sí, guardar' }))

  expect(await screen.findByText('la lista de stock')).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/stock/entries/10', expect.objectContaining({ method: 'PUT' }))
})

test('deleting an entry confirms first, naming the date, variety and grams', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/varieties') return Promise.resolve(jsonResponse(200, VARIETIES))
      if (url === '/stock/entries/10') {
        return Promise.resolve(
          jsonResponse(200, {
            id: 10,
            date: '2026-09-20',
            variety_id: 3,
            origin: 'harvest',
            grams: 25,
            total_cost: null,
            cost_per_gram: null,
            note: null,
          }),
        )
      }
      return Promise.resolve(new Response(null, { status: 204 }))
    }),
  )
  renderForm('/mi-stock/entradas/10')

  await userEvent.click(await screen.findByRole('button', { name: 'Borrar entrada' }))

  const dialog = await screen.findByRole('alertdialog')
  expect(dialog).toHaveTextContent('20/09')
  expect(dialog).toHaveTextContent('Sir Jack')
  expect(dialog).toHaveTextContent('25 g')

  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrala' }))

  expect(await screen.findByText('la lista de stock')).toBeInTheDocument()
  expect(screen.getByText('Entrada eliminada')).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/stock/entries/10', expect.objectContaining({ method: 'DELETE' }))
})
