/**
 * The in-page expense edit in Expenses as a history entry (ADR-0078), at the `Gastos` screen seam:
 * the real data router, Testing Library, `fetch` faked. The form is made dirty only through Details,
 * never through Category (a control another subtask replaces).
 */

import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { sheetDepth } from '../components/useSheetStack'
import { EXPENSES, MORE } from '../routes'
import { flipViewport, stubViewport } from '../test-viewport'
import { type FetchImpl, jsonResponse, renderExpenses } from './expenses/renderExpenses'

const CATEGORIES = [
  { id: 1, name: 'Packaging' },
  { id: 2, name: 'Otros' },
]

function fetchFake(): FetchImpl {
  const rows = [
    { id: 9, spent_on: '2026-09-28', category_id: 1, amount: 4500, detail: 'Bolsas' },
    { id: 8, spent_on: '2026-10-01', category_id: 1, amount: 1200, detail: 'Cinta' },
  ]
  return async (url, init) => {
    const method = init?.method ?? 'GET'
    const view = /^\/expenses\?month=(\d{4}-\d{2})$/.exec(url)
    if (view !== null && method === 'GET') {
      const month = view[1] ?? ''
      const inMonth = rows.filter((row) => row.spent_on.startsWith(month))
      return jsonResponse(200, {
        month,
        total: inMonth.reduce((sum, row) => sum + row.amount, 0),
        categories:
          inMonth.length === 0
            ? []
            : [{ id: 1, name: 'Packaging', subtotal: 0, expenses: inMonth }],
      })
    }
    if (url === '/expense-categories' && method === 'GET') return jsonResponse(200, CATEGORIES)
    const one = /^\/expenses\/(\d+)$/.exec(url)
    if (one !== null && method === 'PUT') {
      return jsonResponse(200, { id: Number(one[1]), ...JSON.parse(String(init?.body)) })
    }
    if (one !== null && method === 'DELETE') return new Response(null, { status: 204 })
    throw new Error(`unexpected ${method} ${url}`)
  }
}

const SEPTEMBER = `${EXPENSES}?month=2026-09`

async function openEdit(): Promise<void> {
  await userEvent.click(await screen.findByText('Bolsas'))
  await screen.findByLabelText('Details')
}

async function makeDirty(): Promise<void> {
  await userEvent.type(screen.getByLabelText('Details'), ' x')
}

const DISCARD = 'Discard the changes?'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('phone: opening the edit is one history entry, and back from a clean edit closes it on the same month', async () => {
  stubViewport('phone')
  const router = renderExpenses([SEPTEMBER], fetchFake())
  await openEdit()
  expect(sheetDepth(router.state.location.state)).toBe(1)

  await act(() => router.navigate(-1))

  expect(screen.queryByLabelText('Details')).not.toBeInTheDocument()
  expect(router.state.location.pathname).toBe(EXPENSES)
  expect(router.state.location.search).toBe('?month=2026-09')
  expect(screen.getByText('September 2026')).toBeInTheDocument()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('phone: back from a dirty edit asks once; keeping stays, discarding returns to the month without a second ask', async () => {
  stubViewport('phone')
  const router = renderExpenses([SEPTEMBER], fetchFake())
  await openEdit()
  await makeDirty()

  await act(() => router.navigate(-1))
  expect(await screen.findByText(DISCARD)).toBeInTheDocument()
  expect(screen.getAllByRole('alertdialog')).toHaveLength(1)

  await userEvent.click(screen.getByRole('button', { name: 'No, keep editing' }))
  expect(screen.getByLabelText('Details')).toHaveValue('Bolsas x')
  expect(sheetDepth(router.state.location.state)).toBe(1)

  await act(() => router.navigate(-1))
  await userEvent.click(await screen.findByRole('button', { name: 'Yes, discard them' }))

  await waitFor(() => expect(screen.queryByLabelText('Details')).not.toBeInTheDocument())
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(router.state.location.search).toBe('?month=2026-09')
  expect(sheetDepth(router.state.location.state)).toBe(0)
  expect(fetch).not.toHaveBeenCalledWith('/expenses/9', expect.objectContaining({ method: 'PUT' }))
})

test('phone: Close on a dirty edit asks once', async () => {
  stubViewport('phone')
  const router = renderExpenses([SEPTEMBER], fetchFake())
  await openEdit()
  await makeDirty()

  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  expect(await screen.findByText(DISCARD)).toBeInTheDocument()
  expect(screen.getAllByRole('alertdialog')).toHaveLength(1)
  expect(sheetDepth(router.state.location.state)).toBe(1)
})

test('phone: Close and back in the same tick show a single dialog', async () => {
  stubViewport('phone')
  const router = renderExpenses([SEPTEMBER], fetchFake())
  await openEdit()
  await makeDirty()
  const close = screen.getByRole('button', { name: 'Close' })

  await act(async () => {
    close.click()
    void router.navigate(-1)
  })

  expect(await screen.findByText(DISCARD)).toBeInTheDocument()
  expect(screen.getAllByRole('alertdialog')).toHaveLength(1)
  await userEvent.click(screen.getByRole('button', { name: 'No, keep editing' }))
  expect(screen.getByLabelText('Details')).toHaveValue('Bolsas x')
  expect(sheetDepth(router.state.location.state)).toBe(1)
})

test('phone: a save returns to Expenses with the toast and leaves no entry behind', async () => {
  stubViewport('phone')
  const router = renderExpenses([SEPTEMBER], fetchFake())
  await openEdit()
  await makeDirty()

  await userEvent.click(screen.getByRole('button', { name: 'Save the expense' }))

  expect(await screen.findAllByText('Expense saved')).toHaveLength(1)
  expect(screen.queryByLabelText('Details')).not.toBeInTheDocument()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  await waitFor(() => expect(sheetDepth(router.state.location.state)).toBe(0))
  expect(router.state.location.search).toBe('?month=2026-09')
  expect(router.state.historyAction).toBe('POP')
})

test('phone: deleting from a dirty edit opens the delete confirmation on the month, without LeaveConfirm', async () => {
  stubViewport('phone')
  const router = renderExpenses([SEPTEMBER], fetchFake())
  await openEdit()
  await makeDirty()

  await userEvent.click(screen.getByRole('button', { name: 'Delete expense' }))

  expect(await screen.findByText('Delete the expense?')).toBeInTheDocument()
  expect(screen.queryByText(DISCARD)).not.toBeInTheDocument()
  await waitFor(() => expect(sheetDepth(router.state.location.state)).toBe(0))
  expect(router.state.location.search).toBe('?month=2026-09')
  expect(screen.queryByLabelText('Details')).not.toBeInTheDocument()
})

test('resize: phone to computer with a dirty edit keeps what was typed and drops the entry', async () => {
  stubViewport('phone')
  const router = renderExpenses([SEPTEMBER], fetchFake())
  await openEdit()
  await makeDirty()

  flipViewport('computer')

  await waitFor(() => expect(sheetDepth(router.state.location.state)).toBe(0))
  expect(screen.getByLabelText('Details')).toHaveValue('Bolsas x')
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('resize: phone to computer with the leave dialog up resets it and keeps the edit', async () => {
  stubViewport('phone')
  const router = renderExpenses([SEPTEMBER], fetchFake())
  await openEdit()
  await makeDirty()
  await act(() => router.navigate(-1))
  expect(await screen.findByText(DISCARD)).toBeInTheDocument()

  flipViewport('computer')

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(screen.getByLabelText('Details')).toHaveValue('Bolsas x')
})

test('resize: after turning computer, a tab-bar navigation with a dirty edit asks nothing', async () => {
  stubViewport('phone')
  const router = renderExpenses([MORE, SEPTEMBER], fetchFake())
  await openEdit()
  await makeDirty()
  flipViewport('computer')
  await waitFor(() => expect(sheetDepth(router.state.location.state)).toBe(0))

  await act(() => router.navigate(MORE))

  expect(router.state.location.pathname).toBe(MORE)
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('resize: computer to phone, then back closes a clean edit', async () => {
  stubViewport('computer')
  const router = renderExpenses([SEPTEMBER], fetchFake())
  await openEdit()
  expect(sheetDepth(router.state.location.state)).toBe(0)

  flipViewport('phone')
  await waitFor(() => expect(sheetDepth(router.state.location.state)).toBe(1))
  await act(() => router.navigate(-1))

  expect(screen.queryByLabelText('Details')).not.toBeInTheDocument()
  expect(router.state.location.search).toBe('?month=2026-09')
})

test('resize: computer to phone, then back from a dirty edit asks', async () => {
  stubViewport('computer')
  const router = renderExpenses([SEPTEMBER], fetchFake())
  await openEdit()
  await makeDirty()

  flipViewport('phone')
  await waitFor(() => expect(sheetDepth(router.state.location.state)).toBe(1))
  await act(() => router.navigate(-1))

  expect(await screen.findByText(DISCARD)).toBeInTheDocument()
  expect(screen.getByLabelText('Details')).toHaveValue('Bolsas x')
})

test('phone: with the Category list open back closes only the list and the edit stays; a second back asks', async () => {
  stubViewport('phone')
  const router = renderExpenses([SEPTEMBER], fetchFake())
  await openEdit()
  await makeDirty()
  await userEvent.click(await screen.findByRole('button', { name: /^Category/ }))
  await screen.findByRole('dialog', { name: 'Category options' })
  expect(sheetDepth(router.state.location.state)).toBe(2)

  await act(() => router.navigate(-1))

  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Category options' })).toBeNull())
  expect(sheetDepth(router.state.location.state)).toBe(1)
  expect(screen.getByLabelText('Details')).toHaveValue('Bolsas x')
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

  await act(() => router.navigate(-1))
  expect(await screen.findByText(DISCARD)).toBeInTheDocument()
})

test('computer: Escape with the Category dropdown open closes only the dropdown', async () => {
  stubViewport('computer')
  renderExpenses([SEPTEMBER], fetchFake())
  await openEdit()
  await userEvent.click(await screen.findByRole('button', { name: /^Category/ }))
  expect(await screen.findByRole('listbox', { name: 'Category options' })).toBeInTheDocument()

  await userEvent.keyboard('{Escape}')

  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
  expect(screen.getByLabelText('Details')).toBeInTheDocument()
  expect(screen.queryByText(DISCARD)).not.toBeInTheDocument()
})

test('computer: Close on a dirty edit asks as before and never touches the history', async () => {
  stubViewport('computer')
  const router = renderExpenses([SEPTEMBER], fetchFake())
  await openEdit()
  await makeDirty()

  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(await screen.findByText(DISCARD)).toBeInTheDocument()
  expect(sheetDepth(router.state.location.state)).toBe(0)
  await userEvent.click(screen.getByRole('button', { name: 'No, keep editing' }))
  expect(screen.getByLabelText('Details')).toHaveValue('Bolsas x')

  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  await userEvent.click(screen.getByRole('button', { name: 'Yes, discard them' }))

  expect(screen.queryByLabelText('Details')).not.toBeInTheDocument()
  expect(router.state.location.search).toBe('?month=2026-09')
  expect(sheetDepth(router.state.location.state)).toBe(0)
})
