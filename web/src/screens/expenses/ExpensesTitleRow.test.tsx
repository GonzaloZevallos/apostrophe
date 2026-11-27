/**
 * Expenses' title row at the screen seam (plan, GH-1053 part 5): `Gastos` on the phone and
 * `ExpensesBehind` (behind the New expense Sheet, on a direct address) draw one row, the round
 * back, the title and Add expense, through `ExpensesTitleRow`; the computer keeps today's header.
 * Through the real data router and the real `Shell`, `fetch` faked.
 */

import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { COMMON_TEXT } from '../../copy/common'
import { EXPENSE_NEW, EXPENSES } from '../../routes'
import { stubViewport } from '../../test-viewport'
import { behindPane, expectBehindPane, expectBehindPaneEmpty } from '../../test/behindPane'
import { type FetchImpl, ME, jsonResponse, renderExpenses } from './renderExpenses'

const VIEW = { month: '2026-10', total: 0, categories: [] }
const BACK = /Analysis/

function api(view: () => Promise<Response> = async () => jsonResponse(200, VIEW)): FetchImpl {
  return async (url, init) => {
    const method = init?.method ?? 'GET'
    if (url.startsWith('/expense-categories') && method === 'GET') return jsonResponse(200, [])
    if (url === `/expenses?month=${ME.today.slice(0, 7)}` && method === 'GET') return view()
    throw new Error(`unexpected ${method} ${url}`)
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

/** What a row is made of, read from the DOM: the tag and class of each child, in order. */
function shapeOf(row: HTMLElement): string[] {
  return Array.from(row.children).map((child) => `${child.tagName.toLowerCase()}.${child.className}`)
}

/** The row that holds the title: the title's parent. */
function rowOf(container: HTMLElement): HTMLElement {
  const parent = within(container).getByText(COMMON_TEXT.expenses).parentElement
  if (parent === null) throw new Error('the title has no row')
  return parent
}

test('on the phone, Expenses has exactly one back, first in the title row, then the title and Add expense', async () => {
  stubViewport('phone')
  renderExpenses([EXPENSES], api())

  await screen.findByText('October 2026')
  const backs = screen.getAllByRole('button', { name: BACK })
  expect(backs).toHaveLength(1)
  const back = backs[0]
  if (back === undefined) throw new Error('no back')
  expect(back).toHaveAccessibleName(`‹ Analysis`)

  const row = rowOf(screen.getByRole('main'))
  expect(row).toContainElement(back)
  expect(row).toContainElement(screen.getByRole('link', { name: COMMON_TEXT.addExpense }))
  // The back is the row's first item and the month line is not in the row.
  expect(row.firstElementChild).toContainElement(back)
  expect(row).not.toContainElement(screen.getByRole('button', { name: COMMON_TEXT.previousMonth }))
})

test('on the computer, Expenses keeps today\'s header: no back, the month and Add expense in the title\'s row', async () => {
  stubViewport('computer')
  renderExpenses([EXPENSES], api())

  await screen.findByText('October 2026')
  expect(screen.queryAllByRole('button', { name: /^‹/ })).toEqual([])
  const row = rowOf(screen.getByRole('main'))
  expect(row).toContainElement(screen.getByRole('link', { name: COMMON_TEXT.addExpense }))
  expect(row).toContainElement(screen.getByRole('button', { name: COMMON_TEXT.previousMonth }))
  expect(row).toContainElement(screen.getByRole('button', { name: COMMON_TEXT.nextMonth }))
})

test('behind the New expense Sheet on the phone, the row is the screen\'s own and every back is out of reach', async () => {
  stubViewport('phone')
  renderExpenses([EXPENSES], api())
  await screen.findByText('October 2026')
  const screenShape = shapeOf(rowOf(screen.getByRole('main')))
  cleanup()
  renderExpenses([EXPENSE_NEW], api())
  const pane = behindPane()
  await waitFor(() => expect(pane).toHaveTextContent('October 2026'))
  expectBehindPane(pane)

  // The pane's row is built by the same component: same items, same classes, in the same order.
  expect(shapeOf(rowOf(pane))).toEqual(screenShape)
  // Every back on the page is inside the inert, hidden background; none is reachable.
  const reachable = screen.queryAllByRole('button', { name: BACK })
  expect(reachable).toEqual([])
  const all = Array.from(document.querySelectorAll('button')).filter((button) => /Analysis/.test(button.textContent ?? ''))
  expect(all.length).toBeGreaterThan(0)
  for (const back of all) expect(back.closest('[inert], [aria-hidden="true"]')).not.toBeNull()
})

test('behind the Sheet, the row draws nothing while Expenses is pending and nothing after a failed GET', async () => {
  stubViewport('phone')
  renderExpenses([EXPENSE_NEW], api(() => new Promise<Response>(() => undefined)))
  await screen.findByRole('dialog', { name: COMMON_TEXT.addExpense })
  expectBehindPaneEmpty(behindPane())
})

test('behind the Sheet, a failed GET leaves the pane empty', async () => {
  stubViewport('phone')
  renderExpenses([EXPENSE_NEW], api(async () => jsonResponse(500, {})))
  await screen.findByRole('dialog', { name: COMMON_TEXT.addExpense })
  await new Promise((resolve) => setTimeout(resolve, 30))
  expectBehindPaneEmpty(behindPane())
})
