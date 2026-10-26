/**
 * The expense form as a sheet, at the screen seam: Testing Library through the real data router,
 * `fetch` faked. On a phone a direct address to the new-expense route shows the sheet over Expenses
 * (an inert, hidden `BehindPane`), and editing in Expenses opens an in-page sheet with the screen
 * itself behind it. Focus is in the first field, there is exactly one Close, and the destructive
 * action sits above Save inside the pinned actions (ADR-0053).
 */

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { COMMON_TEXT } from '../../copy/common'
import { EXPENSES_TEXT } from '../../copy/expenses'
import { EXPENSE_NEW, EXPENSES } from '../../routes'
import { stubViewport } from '../../test-viewport'
import { behindPane, expectBehindPane, expectBehindPaneEmpty } from '../../test/behindPane'
import { type FetchImpl, ME, jsonResponse, renderExpenses } from './renderExpenses'

const VIEW = {
  month: '2026-10',
  total: 4500,
  categories: [
    {
      id: 1,
      name: 'Packaging',
      subtotal: 4500,
      expenses: [{ id: 9, spent_on: '2026-10-01', category_id: 1, amount: 4500, detail: 'Bolsas' }],
    },
  ],
}

function api(view: () => Promise<Response> = async () => jsonResponse(200, VIEW)): FetchImpl {
  return async (url, init) => {
    const method = init?.method ?? 'GET'
    if (url.startsWith('/expense-categories') && method === 'GET') return jsonResponse(200, [{ id: 1, name: 'Packaging' }])
    if (url === `/expenses?month=${ME.today.slice(0, 7)}` && method === 'GET') return view()
    throw new Error(`unexpected ${method} ${url}`)
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('a direct address to the new expense shows the sheet over Expenses, focus in the first field, one Close', async () => {
  renderExpenses([EXPENSE_NEW], api())

  const dialog = await screen.findByRole('dialog', { name: COMMON_TEXT.addExpense })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  await waitFor(() => expect(screen.getByLabelText(COMMON_TEXT.date)).toHaveFocus())
  expect(screen.getAllByRole('button', { name: COMMON_TEXT.close })).toHaveLength(1)
  expect(within(dialog).getByRole('button', { name: COMMON_TEXT.close })).toBeInTheDocument()
  expect(document.querySelector('.sheet__actions')).toContainElement(
    screen.getByRole('button', { name: EXPENSES_TEXT.saveTheExpense }),
  )

  const pane = behindPane()
  expectBehindPane(pane)
  await waitFor(() => expect(pane).toHaveTextContent('Packaging'))
  expect(pane).toHaveTextContent('Bolsas')
  expect(pane).not.toContainElement(dialog)
})

test('while Expenses is pending, and when it fails, the pane is empty', async () => {
  renderExpenses([EXPENSE_NEW], api(() => new Promise<Response>(() => undefined)))

  await screen.findByRole('dialog', { name: COMMON_TEXT.addExpense })
  expectBehindPaneEmpty(behindPane())
})

test('a server error on Expenses leaves the pane empty, with no wording of its own', async () => {
  renderExpenses([EXPENSE_NEW], api(async () => jsonResponse(500, {})))

  await screen.findByRole('dialog', { name: COMMON_TEXT.addExpense })
  await new Promise((resolve) => setTimeout(resolve, 30))
  expectBehindPaneEmpty(behindPane())
})

test('editing an expense opens an in-page sheet with Delete above Save, focus in the first field, and no pane', async () => {
  renderExpenses([EXPENSES], api())

  await userEvent.click(await screen.findByRole('button', { name: /Bolsas/ }))

  const dialog = await screen.findByRole('dialog', { name: EXPENSES_TEXT.editExpense })
  await waitFor(() => expect(within(dialog).getByLabelText(COMMON_TEXT.date)).toHaveFocus())
  expect(screen.getAllByRole('button', { name: COMMON_TEXT.close })).toHaveLength(1)
  expect(document.querySelector('.behind-pane')).toBeNull()

  const actions = document.querySelector('.sheet__actions')
  const buttons = Array.from(actions?.querySelectorAll('button') ?? []).map((button) => button.getAttribute('aria-label') ?? button.textContent)
  expect(buttons).toEqual([EXPENSES_TEXT.deleteExpense, EXPENSES_TEXT.saveTheExpense])
})

test('on a computer the edit keeps its frame: .capa presentation, and the discard question inside .capa__contenido', async () => {
  stubViewport('computer')
  renderExpenses([EXPENSES], api())

  await userEvent.click(await screen.findByRole('button', { name: /Bolsas/ }))
  await userEvent.type(await screen.findByLabelText('Details'), ' x')
  await userEvent.click(screen.getByRole('button', { name: COMMON_TEXT.close }))

  const question = await screen.findByText(COMMON_TEXT.discardTheChanges)
  const capa = document.querySelector('.capa')
  expect(capa).toHaveAttribute('role', 'presentation')
  expect(question.closest('.capa__contenido')).not.toBeNull()
  expect(capa?.querySelector(':scope > .capa__contenido')).toContainElement(question)
  expect(document.querySelector('.sheet__actions')).toBeNull()
})
