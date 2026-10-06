/**
 * `ExpenseNewRoute` at the screen seam (plan, subtask `expense-form`): through the
 * real data router with `fetch` faked. The route owns how the form is left: back by
 * history to whichever screen opened it, "Gasto guardado" there, the discard
 * confirmation, and the fallback when there is no history.
 */

import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { EXPENSES, EXPENSE_NEW, MORE } from '../../routes'
import { type FetchImpl, ME, jsonResponse, renderExpenses } from './renderExpenses'

const CATEGORIES = [
  { id: 1, name: 'Packaging' },
  { id: 2, name: 'Otros' },
]

const EMPTY_VIEW = { month: '2026-10', total: 0, categories: [] }

function api(): FetchImpl {
  return async (url, init) => {
    const method = init?.method ?? 'GET'
    if (url.startsWith('/expense-categories') && method === 'GET') return jsonResponse(200, CATEGORIES)
    if (url.startsWith('/expenses?month=') && method === 'GET') return jsonResponse(200, EMPTY_VIEW)
    if (url === '/expenses' && method === 'POST') {
      return jsonResponse(201, { id: 10, spent_on: ME.today, category_id: 1, amount: 1000, detail: 'Cinta' })
    }
    throw new Error(`unexpected ${method} ${url}`)
  }
}

async function fillForm(): Promise<void> {
  await userEvent.selectOptions(await screen.findByLabelText('Categoría'), 'Packaging')
  await userEvent.type(screen.getByLabelText('Monto'), '1000')
  await userEvent.type(screen.getByLabelText('Detalle'), 'Cinta')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('a save opened from Más goes back to Más and toasts "Gasto guardado" there, once', async () => {
  const router = renderExpenses([MORE], api())

  await userEvent.click(await screen.findByRole('link', { name: 'Cargar gasto desde Más' }))
  await fillForm()
  await userEvent.click(screen.getByRole('button', { name: 'Guardá el gasto' }))

  expect(await screen.findByText('Pantalla Más')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(MORE)
  expect(await screen.findAllByText('Gasto guardado')).toHaveLength(1)
})

test('the date is today', async () => {
  renderExpenses([MORE, EXPENSE_NEW], api())

  expect(await screen.findByLabelText('Fecha')).toHaveValue(ME.today)
})

test('an untouched form closes at once, back to the screen that opened it', async () => {
  const router = renderExpenses([MORE, EXPENSE_NEW], api())

  await userEvent.click(await screen.findByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('Pantalla Más')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(MORE)
  expect(screen.queryByText('Gasto guardado')).not.toBeInTheDocument()
})

test('"Cerrar" is there and works while the categories are still loading', async () => {
  const pending: FetchImpl = async (url, init) => {
    if (url.startsWith('/expense-categories') && (init?.method ?? 'GET') === 'GET') {
      return new Promise(() => undefined)
    }
    return api()(url, init)
  }
  const router = renderExpenses([MORE, EXPENSE_NEW], pending)

  await userEvent.click(await screen.findByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('Pantalla Más')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(MORE)
})

test('closing with something typed asks before discarding; staying keeps the form', async () => {
  const router = renderExpenses([MORE, EXPENSE_NEW], api())

  await userEvent.type(await screen.findByLabelText('Detalle'), 'Cinta')
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('¿Descartás el gasto?')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'No, seguí cargando' }))

  expect(screen.queryByText('¿Descartás el gasto?')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Detalle')).toHaveValue('Cinta')
  expect(router.state.location.pathname).toBe(EXPENSE_NEW)
})

test('confirming the discard leaves the form and saves nothing', async () => {
  const router = renderExpenses([MORE, EXPENSE_NEW], api())

  await userEvent.type(await screen.findByLabelText('Detalle'), 'Cinta')
  await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Sí, descartalo' }))

  expect(await screen.findByText('Pantalla Más')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(MORE)
  expect(fetch).not.toHaveBeenCalledWith('/expenses', expect.objectContaining({ method: 'POST' }))
})

test('with no history, closing goes to Gastos on the current month', async () => {
  const router = renderExpenses([EXPENSE_NEW], api())

  await userEvent.click(await screen.findByRole('button', { name: 'Cerrar' }))

  expect(await screen.findByText('Gastaste en el mes', {}, { timeout: 5000 })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(EXPENSES)
  expect(router.state.location.search).toBe('')
}, 15000)

test('with no history, a save goes to Gastos and toasts there', async () => {
  const router = renderExpenses([EXPENSE_NEW], api())

  await fillForm()
  await userEvent.click(screen.getByRole('button', { name: 'Guardá el gasto' }))

  // The save, the redirect and Gastos' own fetch run after a full form fill: under the whole
  // suite's parallel load the default one-second wait was flaky, so this one waits longer.
  expect(await screen.findByText('Gastaste en el mes', {}, { timeout: 5000 })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(EXPENSES)
  expect(await screen.findAllByText('Gasto guardado', {}, { timeout: 5000 })).toHaveLength(1)
}, 15000)

test('the form route has no bar and no "Nueva venta"; Gastos has both', async () => {
  renderExpenses([EXPENSES], api())
  await screen.findByText('Gastaste en el mes')
  const navsOnGastos = screen.getAllByRole('navigation').length
  expect(screen.getAllByRole('link', { name: 'Nueva venta' }).length).toBeGreaterThan(0)

  await userEvent.click(screen.getByRole('link', { name: 'Cargar gasto' }))
  await screen.findByLabelText('Detalle')

  expect(screen.queryByRole('link', { name: 'Nueva venta' })).not.toBeInTheDocument()
  expect(screen.getAllByRole('navigation')).toHaveLength(navsOnGastos - 1)
})
