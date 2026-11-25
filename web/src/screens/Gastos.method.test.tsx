/**
 * The "Latest" rows of `Gastos` and how each expense was paid (GH-520 part 4), at the Expenses
 * screen seam: the real data router, Testing Library, `fetch` faked. The method's name is read
 * from the expense's own `payment_method`; the row never asks for the list of methods.
 */

import { screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { EXPENSES } from '../routes'
import { type FetchImpl, jsonResponse, renderExpenses } from './expenses/renderExpenses'

interface Method {
  id: number
  name: string
  icon: string
}

interface Row {
  id: number
  spent_on: string
  category_id: number
  amount: number
  detail: string
  payment_method: Method | null
}

const CASH: Method = { id: 1, name: 'Cash', icon: 'banknote' }

function row(overrides: Partial<Row> & { id: number }): Row {
  return { spent_on: '2026-10-01', category_id: 1, amount: 4500, detail: 'Bolsas', payment_method: null, ...overrides }
}

function fetchFake(rows: Row[], seen: string[] = []): FetchImpl {
  return async (url) => {
    seen.push(url)
    const view = /^\/expenses\?month=(\d{4}-\d{2})$/.exec(url)
    if (view !== null) {
      return jsonResponse(200, {
        month: view[1],
        total: rows.reduce((sum, one) => sum + one.amount, 0),
        categories: [{ id: 1, name: 'Packaging', subtotal: 0, expenses: rows }],
      })
    }
    if (url === '/expense-categories') return jsonResponse(200, [{ id: 1, name: 'Packaging' }])
    throw new Error(`unexpected GET ${url}`)
  }
}

/** The row's button: the one whose name holds its amount. */
async function rowOf(amount: string): Promise<HTMLElement> {
  return screen.findByRole('button', { name: new RegExp(amount.replace('.', '\\.')) })
}

/** The row's texts in order, from the spans that hold text directly (not their wrappers). */
function leafTexts(fila: HTMLElement): (string | null)[] {
  return Array.from(fila.querySelectorAll('span'))
    .filter((span) => span.childElementCount === 0)
    .map((span) => span.textContent)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('a row with a method shows its name inside the row', async () => {
  renderExpenses([EXPENSES], fetchFake([row({ id: 1, payment_method: CASH })]))
  const fila = await rowOf('4.500')
  expect(within(fila).getByText('Cash')).toBeInTheDocument()
  expect(within(fila).getByText('Bolsas')).toBeInTheDocument()
})

test('a row without a method shows no method text, no separator and the same parts as before', async () => {
  renderExpenses([EXPENSES], fetchFake([row({ id: 1 })]))
  const fila = await rowOf('4.500')
  expect(within(fila).queryByText('·')).not.toBeInTheDocument()
  const parts = leafTexts(fila)
  expect(parts.slice(1)).toEqual(['Packaging', 'Bolsas', '$ 4.500'])
})

test('an empty detail without a method shows the category once and no lower line', async () => {
  renderExpenses([EXPENSES], fetchFake([row({ id: 1, detail: '' })]))
  const fila = await rowOf('4.500')
  expect(within(fila).getAllByText('Packaging')).toHaveLength(1)
  expect(within(fila).queryByText('·')).not.toBeInTheDocument()
  const parts = leafTexts(fila)
  expect(parts.slice(1)).toEqual(['Packaging', '$ 4.500'])
})

test('an empty detail with a method shows the category once, the name and no separator', async () => {
  renderExpenses([EXPENSES], fetchFake([row({ id: 1, detail: '', payment_method: CASH })]))
  const fila = await rowOf('4.500')
  expect(within(fila).getAllByText('Packaging')).toHaveLength(1)
  expect(within(fila).getByText('Cash')).toBeInTheDocument()
  expect(within(fila).queryByText('·')).not.toBeInTheDocument()
})

test('a detail and a method are joined by a separator hidden from assistive technology', async () => {
  renderExpenses([EXPENSES], fetchFake([row({ id: 1, payment_method: CASH })]))
  const fila = await rowOf('4.500')
  expect(within(fila).getByText('·')).toHaveAttribute('aria-hidden', 'true')
})

test('an archived or renamed method shows its name from the response, with no request for the methods', async () => {
  const seen: string[] = []
  const archived = { id: 7, name: 'Old card', icon: 'card' }
  renderExpenses([EXPENSES], fetchFake([row({ id: 1, payment_method: archived })], seen))
  const fila = await rowOf('4.500')
  expect(within(fila).getByText('Old card')).toBeInTheDocument()
  expect(seen.some((url) => url.includes('payment-methods'))).toBe(false)
})

test("the row's accessible name holds the method's name only when there is one", async () => {
  renderExpenses(
    [EXPENSES],
    fetchFake([row({ id: 1, payment_method: CASH }), row({ id: 2, amount: 1200, detail: 'Cinta' })]),
  )
  expect(await screen.findByRole('button', { name: /Cash/ })).toHaveTextContent('4.500')
  expect(await rowOf('1.200')).not.toHaveAccessibleName(/Cash/)
})

test('a long name next to a long detail keeps both whole in the DOM', async () => {
  const detail = 'Bolsas de papel kraft con manija para la feria del sábado'
  const name = 'Tarjeta de crédito del banco de la esquina'
  renderExpenses([EXPENSES], fetchFake([row({ id: 1, detail, payment_method: { id: 3, name, icon: 'card' } })]))
  const fila = await rowOf('4.500')
  expect(within(fila).getByText(detail)).toBeInTheDocument()
  expect(within(fila).getByText(name)).toBeInTheDocument()
})
