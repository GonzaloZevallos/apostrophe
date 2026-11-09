/**
 * An amount with more decimals than the business allows, at the screen seam: Testing Library
 * through the real data router with `fetch` faked to answer 422 `money.too_many_decimals`.
 * The fixed copy shows under the amount field, what was typed stays, and the response's
 * `detail` is never shown (ADR-0058, ADR-0008).
 */

import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { moneyTooManyDecimals } from '../../copy/settings'
import { EXPENSE_NEW, EXPENSES } from '../../routes'
import { stubViewport } from '../../test-viewport'
import { type FetchImpl, ME, jsonResponse, renderExpenses } from './renderExpenses'

const DETAIL_FROM_THE_SERVER = 'server words that must never reach the screen'

function api(): FetchImpl {
  return async (url, init) => {
    const method = init?.method ?? 'GET'
    if (url.startsWith('/expense-categories') && method === 'GET') return jsonResponse(200, [{ id: 1, name: 'Packaging' }])
    if (url.startsWith('/expenses?month=') && method === 'GET') {
      return jsonResponse(200, { month: ME.today.slice(0, 7), total: 0, categories: [] })
    }
    if (url === EXPENSES && method === 'POST') {
      return jsonResponse(422, { detail: DETAIL_FROM_THE_SERVER, code: 'money.too_many_decimals' })
    }
    throw new Error(`unexpected ${method} ${url}`)
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('a refused amount shows the whole-amounts copy under the field and keeps what was typed', async () => {
  stubViewport('phone')
  renderExpenses([EXPENSE_NEW], api())

  await userEvent.selectOptions(await screen.findByLabelText('Category'), 'Packaging')
  await userEvent.type(screen.getByLabelText('Amount'), '1000')
  await userEvent.type(screen.getByLabelText('Details'), 'Cinta')
  await userEvent.click(screen.getByRole('button', { name: 'Save the expense' }))

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent(moneyTooManyDecimals(0))
  expect(alert).toHaveTextContent('Use whole amounts only.')
  expect(screen.queryByText(DETAIL_FROM_THE_SERVER)).not.toBeInTheDocument()
  expect(screen.getByLabelText(/^Amount/)).toHaveValue('1000')
  expect(screen.getByLabelText('Details')).toHaveValue('Cinta')
})

test('the copy names the decimals the business allows when it allows any', () => {
  expect(moneyTooManyDecimals(0)).toBe('Use whole amounts only.')
  expect(moneyTooManyDecimals(2)).toBe('Use up to 2 decimals.')
})
