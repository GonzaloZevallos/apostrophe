/**
 * "How you paid" on the expense form, at the host seam: Testing Library through the real data router
 * with `fetch` faked. The stored method id travels on every save, a refused method marks its field
 * and keeps everything typed, and the Save label shows the amount once it is valid.
 */

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { EXPENSES, EXPENSE_NEW } from '../../routes'
import { stubViewport } from '../../test-viewport'
import { type FetchImpl, ME, chooseCategory, jsonResponse, renderExpenses } from './renderExpenses'

const STORED = { id: 7, name: 'Nequi', icon: 'wallet' }
const VIEW = {
  month: '2026-10',
  total: 4500,
  categories: [
    {
      id: 1,
      name: 'Packaging',
      subtotal: 4500,
      expenses: [{ id: 9, spent_on: '2026-10-01', category_id: 1, amount: 4500, detail: 'Bolsas', payment_method: STORED }],
    },
  ],
}

interface Calls {
  bodies: Record<string, unknown>[]
}

function api(calls: Calls, options: { methods: 'fail' | 'ok'; refuse?: string }): FetchImpl {
  return async (url, init) => {
    const method = init?.method ?? 'GET'
    if (url.startsWith('/expense-categories') && method === 'GET') return jsonResponse(200, [{ id: 1, name: 'Packaging' }])
    if (url.startsWith('/expenses?month=') && method === 'GET') return jsonResponse(200, VIEW)
    if (url === '/api/payment-methods' && method === 'GET') {
      if (options.methods === 'fail') return jsonResponse(500, {})
      return jsonResponse(200, [
        { id: 7, name: 'Nequi', icon: 'wallet', position: 0, in_use: true },
        { id: 8, name: 'Cash', icon: 'cash', position: 1, in_use: false },
      ])
    }
    if (method === 'POST' || method === 'PUT') {
      calls.bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      if (options.refuse !== undefined && calls.bodies.at(-1)?.['payment_method_id'] !== null) {
        return jsonResponse(404, { detail: 'x', code: options.refuse })
      }
      return jsonResponse(200, { id: 9, spent_on: ME.today, category_id: 1, amount: 1, detail: '', payment_method: null })
    }
    throw new Error(`unexpected ${method} ${url}`)
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

async function openEdit(): Promise<void> {
  await userEvent.click(await screen.findByRole('button', { name: /Bolsas/ }))
  await screen.findByLabelText('Details (optional)')
}

test('an edit sends the stored method while the list failed, changing only the amount', async () => {
  stubViewport('phone')
  const calls: Calls = { bodies: [] }
  renderExpenses([EXPENSES], api(calls, { methods: 'fail' }))
  await openEdit()

  const amount = screen.getByLabelText('Amount')
  await userEvent.clear(amount)
  await userEvent.type(amount, '5000')
  await userEvent.click(screen.getByRole('button', { name: /^Save expense/ }))

  await waitFor(() => expect(calls.bodies).toHaveLength(1))
  expect(calls.bodies[0]).toMatchObject({ amount: 5000, payment_method_id: 7 })
})

test('a new expense sends the chosen id, and None sends null', async () => {
  stubViewport('phone')
  const calls: Calls = { bodies: [] }
  renderExpenses([EXPENSE_NEW], api(calls, { methods: 'ok' }))

  await chooseCategory('Packaging')
  await userEvent.type(screen.getByLabelText('Amount'), '1000')
  await userEvent.click(await screen.findByRole('button', { name: /^How you paid/ }))
  await userEvent.click(await screen.findByRole('button', { name: 'Cash' }))
  await userEvent.click(screen.getByRole('button', { name: /^Save expense/ }))
  await waitFor(() => expect(calls.bodies).toHaveLength(1))
  expect(calls.bodies[0]).toMatchObject({ payment_method_id: 8 })
})

test('a new expense with no choice sends null', async () => {
  stubViewport('phone')
  const calls: Calls = { bodies: [] }
  renderExpenses([EXPENSE_NEW], api(calls, { methods: 'ok' }))

  await chooseCategory('Packaging')
  await userEvent.type(screen.getByLabelText('Amount'), '1000')
  await userEvent.click(screen.getByRole('button', { name: /^Save expense/ }))
  await waitFor(() => expect(calls.bodies).toHaveLength(1))
  expect(calls.bodies[0]).toMatchObject({ payment_method_id: null })
})

test('the Save label shows the amount once it is valid, and plain before', async () => {
  stubViewport('phone')
  renderExpenses([EXPENSE_NEW], api({ bodies: [] }, { methods: 'ok' }))

  await screen.findByRole('button', { name: 'Save expense' })
  await userEvent.type(screen.getByLabelText('Amount'), '1000')
  expect(screen.getByRole('button', { name: /^Save expense/ })).toHaveTextContent(/Save expense · \$\s?1[.,]000/)
  expect(screen.getByText(/^\$\s?1[.,]000$/)).toHaveClass('gasto-form__monto')
})

test.each(['payment_method.unavailable', 'payment_method.not_found'])(
  'a %s refusal keeps what was typed, marks the field and blocks Save until None',
  async (code) => {
    stubViewport('phone')
    const calls: Calls = { bodies: [] }
    renderExpenses([EXPENSES], api(calls, { methods: 'ok', refuse: code }))
    await openEdit()

    await userEvent.type(screen.getByLabelText('Details (optional)'), ' x')
    await userEvent.click(screen.getByRole('button', { name: /^Save expense/ }))

    const refusal = await screen.findByText('That payment method is no longer available. Choose another one.')
    expect(screen.getByRole('button', { name: /^How you paid/ })).toHaveAccessibleDescription(refusal.textContent ?? '')
    expect(screen.getByLabelText('Details (optional)')).toHaveValue('Bolsas x')
    expect(screen.getByRole('button', { name: /^Save expense/ })).toBeDisabled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^How you paid/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'None' }))
    await userEvent.click(screen.getByRole('button', { name: /^Save expense/ }))
    await waitFor(() => expect(calls.bodies).toHaveLength(2))
    expect(calls.bodies[1]).toMatchObject({ payment_method_id: null })
  },
)
