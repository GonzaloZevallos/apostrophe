/**
 * "How you paid" on the expense form, at the host seam: Testing Library through the real data router
 * with `fetch` faked. The stored method id travels on every save, a refused method marks its field
 * and keeps everything typed, and the Save label shows the amount once it is valid.
 */

import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ANALYSIS, EXPENSES, EXPENSE_NEW } from '../../routes'
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
  /** How many times the methods list was asked for. */
  listReads?: number
}

const ALL_METHODS = [
  { id: 7, name: 'Nequi', icon: 'wallet', position: 0, in_use: true },
  { id: 8, name: 'Cash', icon: 'cash', position: 1, in_use: false },
]

function api(
  calls: Calls,
  options: { methods: 'fail' | 'ok' | 'held'; refuse?: string; list?: readonly object[]; held?: Promise<void> },
): FetchImpl {
  return async (url, init) => {
    const method = init?.method ?? 'GET'
    if (url.startsWith('/expense-categories') && method === 'GET') return jsonResponse(200, [{ id: 1, name: 'Packaging' }])
    if (url.startsWith('/expenses?month=') && method === 'GET') return jsonResponse(200, VIEW)
    if (url === '/api/payment-methods' && method === 'GET') {
      calls.listReads = (calls.listReads ?? 0) + 1
      if (options.methods === 'fail') return jsonResponse(500, {})
      if (options.methods === 'held') await options.held
      return jsonResponse(200, options.list ?? ALL_METHODS)
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
    const typedAmount = (screen.getByLabelText('Amount') as HTMLInputElement).value
    await userEvent.click(screen.getByRole('button', { name: /^Save expense/ }))

    const refusal = await screen.findByText('That payment method is no longer available. Choose another one.')
    expect(screen.getByRole('button', { name: /^How you paid/ })).toHaveAccessibleDescription(refusal.textContent ?? '')
    expect(screen.getByLabelText('Details (optional)')).toHaveValue('Bolsas x')
    expect(screen.getByLabelText('Amount')).toHaveValue(typedAmount)
    expect(screen.getByRole('button', { name: /^Category/ })).toHaveTextContent('Packaging')
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-01')
    // The refused method is the stored one: the field keeps its stored label, marked.
    expect(screen.getByRole('button', { name: /^How you paid/ })).toHaveTextContent('Nequi')
    expect(screen.getByRole('button', { name: /^How you paid/ })).toHaveTextContent('no longer available')
    expect(screen.getByRole('button', { name: /^Save expense/ })).toBeDisabled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^How you paid/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'None' }))
    await userEvent.click(screen.getByRole('button', { name: /^Save expense/ }))
    await waitFor(() => expect(calls.bodies).toHaveLength(2))
    expect(calls.bodies[1]).toMatchObject({ payment_method_id: null })
  },
)

test('a method picked on a new expense and then refused keeps the name the list showed', async () => {
  stubViewport('phone')
  const calls: Calls = { bodies: [] }
  renderExpenses([EXPENSE_NEW], api(calls, { methods: 'ok', refuse: 'payment_method.unavailable' }))

  await chooseCategory('Packaging')
  await userEvent.type(screen.getByLabelText('Amount'), '1000')
  await userEvent.click(await screen.findByRole('button', { name: /^How you paid/ }))
  await userEvent.click(await screen.findByRole('button', { name: 'Cash' }))
  await userEvent.click(screen.getByRole('button', { name: /^Save expense/ }))

  await screen.findByText('That payment method is no longer available. Choose another one.')
  expect(screen.getByRole('button', { name: /^How you paid/ })).toHaveTextContent('Cash')
  expect(screen.getByRole('button', { name: /^How you paid/ })).toHaveTextContent('no longer available')
  expect(screen.getByLabelText('Amount')).toHaveValue('1000')
})

test('a tap on a failed How you paid field reads the list again, once', async () => {
  stubViewport('phone')
  const calls: Calls = { bodies: [] }
  renderExpenses([EXPENSE_NEW], api(calls, { methods: 'fail' }))

  await chooseCategory('Packaging')
  await waitFor(() => expect(calls.listReads).toBe(1))
  await userEvent.click(await screen.findByRole('button', { name: /^How you paid/ }))
  await waitFor(() => expect(calls.listReads).toBe(2))
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(calls.listReads).toBe(2)
})

describe('history: the method list is its own entry over the form', () => {
  async function typeAndOpenMethods(): Promise<void> {
    await userEvent.type(await screen.findByLabelText('Details (optional)'), 'Cinta')
    await userEvent.click(await screen.findByRole('button', { name: /^How you paid/ }))
    await screen.findByRole('dialog', { name: 'How you paid options' })
  }

  async function backClosesOnlyTheList(router: ReturnType<typeof renderExpenses>): Promise<void> {
    await act(() => router.navigate(-1))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'How you paid options' })).toBeNull())
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect((screen.getByLabelText('Details (optional)') as HTMLInputElement).value).toContain('Cinta')
  }

  test('ExpenseNewRoute: Back closes only the list, with no discard dialog', async () => {
    stubViewport('phone')
    const router = renderExpenses([EXPENSE_NEW], api({ bodies: [] }, { methods: 'ok' }))
    await typeAndOpenMethods()
    await backClosesOnlyTheList(router)
    expect(router.state.location.pathname).toBe(EXPENSE_NEW)
  })

  test('ExpenseNewSheet over Analysis: Back closes only the list, with no discard dialog', async () => {
    stubViewport('phone')
    const router = renderExpenses([ANALYSIS, EXPENSE_NEW], api({ bodies: [] }, { methods: 'ok' }))
    await typeAndOpenMethods()
    await backClosesOnlyTheList(router)
    expect(router.state.location.pathname).toBe(EXPENSE_NEW)
  })

  test('ExpenseEditSheet: Back closes only the list, with no discard dialog', async () => {
    stubViewport('phone')
    const router = renderExpenses([EXPENSES], api({ bodies: [] }, { methods: 'ok' }))
    await openEdit()
    await typeAndOpenMethods()
    await backClosesOnlyTheList(router)
    expect(router.state.location.pathname).toBe(EXPENSES)
  })

  test('the Category and method lists never open each other', async () => {
    stubViewport('phone')
    const router = renderExpenses([EXPENSE_NEW], api({ bodies: [] }, { methods: 'ok' }))

    await userEvent.click(await screen.findByRole('button', { name: /^Category/ }))
    await screen.findByRole('dialog', { name: 'Category options' })
    expect(screen.queryByRole('dialog', { name: 'How you paid options' })).toBeNull()
    await act(() => router.navigate(-1))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Category options' })).toBeNull())

    await userEvent.click(await screen.findByRole('button', { name: /^How you paid/ }))
    await screen.findByRole('dialog', { name: 'How you paid options' })
    expect(screen.queryByRole('dialog', { name: 'Category options' })).toBeNull()
  })
})

test('with the list held, an open list stays open when it arrives, and a stored method it leaves out is marked', async () => {
  stubViewport('phone')
  let release: () => void = () => undefined
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  renderExpenses([EXPENSES], api({ bodies: [] }, { methods: 'held', held, list: [ALL_METHODS[1] ?? {}] }))
  await openEdit()

  await userEvent.click(screen.getByRole('button', { name: /^How you paid/ }))
  await screen.findByRole('dialog', { name: 'How you paid options' })
  expect(screen.getByRole('button', { name: /^How you paid/ })).not.toHaveTextContent('no longer available')

  await act(async () => {
    release()
    await held
  })
  await screen.findByRole('button', { name: 'Cash' })
  expect(screen.getByRole('dialog', { name: 'How you paid options' })).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('button', { name: /^How you paid/ })).toHaveTextContent('no longer available'))
})
