/**
 * The reasons under the Expense form's amount field, at the screen seam: Testing Library through
 * the real data router with `fetch` faked and its POSTs counted. Add and Edit are one form, at 0
 * and at 2 decimals (with another symbol). The sentence is worked out from what is typed, so each
 * rule has a case that fails if a sentence covers another rule's value.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Me } from '../../api/me'
import { EXPENSE_NEW, EXPENSES } from '../../routes'
import { stubViewport } from '../../test-viewport'
import { type FetchImpl, ME, chooseCategory, jsonResponse, renderExpenses } from './renderExpenses'

const VIEW = {
  month: '2026-10',
  total: 4500,
  categories: [
    {
      id: 1,
      name: 'Packaging',
      subtotal: 4500,
      expenses: [{ id: 9, spent_on: '2026-10-01', category_id: 1, amount: 4500, detail: 'Bolsas', payment_method: null }],
    },
  ],
}

const ZERO_DECIMALS: Me = ME
const TWO_DECIMALS: Me = { ...ME, money: { symbol: 'US$', decimals: 2 } }

interface Calls {
  writes: number
  /** When set, a write waits for it before answering. */
  hold?: Promise<void>
}

function api(calls: Calls): FetchImpl {
  return async (url, init) => {
    const method = init?.method ?? 'GET'
    if (url.startsWith('/expense-categories') && method === 'GET') return jsonResponse(200, [{ id: 1, name: 'Packaging' }])
    if (url.startsWith('/expenses?month=') && method === 'GET') return jsonResponse(200, VIEW)
    if (url === '/api/payment-methods' && method === 'GET') return jsonResponse(200, [])
    if (method === 'POST' || method === 'PUT') {
      calls.writes += 1
      await calls.hold
      return jsonResponse(200, { id: 9, spent_on: ME.today, category_id: 1, amount: 1, detail: '', payment_method: null })
    }
    throw new Error(`unexpected ${method} ${url}`)
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const amountField = (): HTMLInputElement => screen.getByLabelText<HTMLInputElement>('Amount')
const saveButton = (): HTMLElement => screen.getByRole('button', { name: /^Save expense/ })
const reasonNow = (): HTMLElement | null => screen.queryByRole('alert')

async function openAdd(me: Me, calls: Calls = { writes: 0 }): Promise<Calls> {
  stubViewport('phone')
  renderExpenses([EXPENSE_NEW], api(calls), me)
  await chooseCategory('Packaging')
  return calls
}

async function openEdit(me: Me, calls: Calls = { writes: 0 }): Promise<Calls> {
  stubViewport('phone')
  renderExpenses([EXPENSES], api(calls), me)
  await userEvent.click(await screen.findByRole('button', { name: /Bolsas/ }))
  await screen.findByLabelText('Details (optional)')
  return calls
}

describe.each([
  ['Add', openAdd],
  ['Edit', openEdit],
] as const)('the amount reasons on %s at 0 decimals', (_mode, open) => {
  async function typeAmount(text: string): Promise<void> {
    await userEvent.clear(amountField())
    if (text !== '') await userEvent.type(amountField(), text)
  }

  test.each([['0'], ['-5'], ['abc']])('%j then blur shows the above-zero reason', async (text) => {
    await open(ZERO_DECIMALS)
    await typeAmount(text)
    expect(reasonNow()).toBeNull()
    await userEvent.tab()
    expect(reasonNow()).toHaveTextContent('The amount must be more than $')
    expect(reasonNow()).not.toHaveTextContent('Use whole amounts only.')
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true')
  })

  test('1,5 shows the too-many-decimals reason live, with no blur', async () => {
    await open(ZERO_DECIMALS)
    await typeAmount('1,5')
    expect(amountField()).toHaveFocus()
    expect(reasonNow()).toHaveTextContent('Use whole amounts only.')
    expect(reasonNow()).not.toHaveTextContent('more than')
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true')
  })

  test('a valid value clears the reason and Save works again', async () => {
    await open(ZERO_DECIMALS)
    await typeAmount('0')
    await userEvent.tab()
    expect(reasonNow()).not.toBeNull()
    await typeAmount('1000')
    expect(reasonNow()).toBeNull()
    expect(saveButton()).not.toHaveAttribute('aria-disabled', 'true')
  })

  test('an empty field shows nothing, before and after blur and after a tap on Save, and keeps Save blocked', async () => {
    const calls = await open(ZERO_DECIMALS)
    await typeAmount('')
    expect(reasonNow()).toBeNull()
    await userEvent.tab()
    expect(reasonNow()).toBeNull()
    await userEvent.click(saveButton())
    expect(reasonNow()).toBeNull()
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true')
    expect(saveButton()).toHaveTextContent('Save expense')
    expect(calls.writes).toBe(0)
  })

  test('the reason is the input description and the input is invalid only while it shows', async () => {
    await open(ZERO_DECIMALS)
    await typeAmount('1')
    expect(amountField()).not.toHaveAttribute('aria-invalid')
    expect(amountField()).toHaveAccessibleName('Amount')
    await typeAmount('1,5')
    expect(amountField()).toHaveAttribute('aria-invalid', 'true')
    expect(amountField()).toHaveAccessibleDescription('Use whole amounts only.')
    await typeAmount('15')
    expect(amountField()).not.toHaveAttribute('aria-invalid')
    expect(amountField()).toHaveAccessibleDescription('')
  })

  test('an 18-digit amount keeps Save blocked and shows no reason, even after blur and a tap', async () => {
    const calls = await open(ZERO_DECIMALS)
    await typeAmount('123456789012345678')
    await userEvent.tab()
    await userEvent.click(saveButton())
    expect(reasonNow()).toBeNull()
    expect(screen.queryByText(/more than/)).not.toBeInTheDocument()
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true')
    expect(calls.writes).toBe(0)
  })

  test('Enter in Amount or in Details and a tap on a blocked Save send nothing', async () => {
    const calls = await open(ZERO_DECIMALS)
    await typeAmount('0')
    await userEvent.keyboard('{Enter}')
    await userEvent.type(screen.getByLabelText('Details (optional)'), 'x{Enter}')
    await userEvent.click(saveButton())
    expect(calls.writes).toBe(0)
  })

  test('a tap on a blocked Save while the field is focused shows the reason and keeps the focus', async () => {
    const calls = await open(ZERO_DECIMALS)
    await typeAmount('0')
    expect(reasonNow()).toBeNull()
    await userEvent.click(saveButton())
    expect(reasonNow()).toHaveTextContent('The amount must be more than $')
    expect(calls.writes).toBe(0)
    expect(amountField()).toHaveFocus()
  })
})

describe('the amount reasons at 2 decimals with another symbol', () => {
  test('1,555 shows the up-to-2-decimals reason live', async () => {
    await openAdd(TWO_DECIMALS)
    await userEvent.type(amountField(), '1,555')
    expect(reasonNow()).toHaveTextContent('Use up to 2 decimals.')
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true')
  })

  test('0 then blur names the formatted zero with the business symbol', async () => {
    await openAdd(TWO_DECIMALS)
    await userEvent.type(amountField(), '0')
    await userEvent.tab()
    expect(reasonNow()?.textContent).toMatch(/^The amount must be more than US\$\s?0[.,]00$/)
  })

  test('1, while focused shows nothing', async () => {
    await openAdd(TWO_DECIMALS)
    await userEvent.type(amountField(), '1,')
    expect(amountField()).toHaveFocus()
    expect(reasonNow()).toBeNull()
  })

  test('11.5 then blur becomes 11,50 with no reason', async () => {
    await openAdd(TWO_DECIMALS)
    await userEvent.type(amountField(), '11.5')
    await userEvent.tab()
    expect(amountField()).toHaveValue('11,50')
    expect(reasonNow()).toBeNull()
    expect(saveButton()).not.toHaveAttribute('aria-disabled', 'true')
  })

  test('the above-zero reason lives with the value: it stays on refocus and follows the typing', async () => {
    await openAdd(TWO_DECIMALS)
    await userEvent.type(amountField(), '0')
    await userEvent.tab()
    expect(reasonNow()).not.toBeNull()
    await userEvent.click(amountField())
    expect(reasonNow()).not.toBeNull()
    await userEvent.type(amountField(), '{Backspace}1,')
    expect(reasonNow()).toBeNull()
    await userEvent.type(amountField(), '5')
    expect(reasonNow()).toBeNull()
    expect(saveButton()).not.toHaveAttribute('aria-disabled', 'true')
  })

  test('an 18-digit amount, or 16 digits plus ,00, is silent and blocked', async () => {
    const calls = await openAdd(TWO_DECIMALS)
    await userEvent.type(amountField(), '1234567890123456,00')
    await userEvent.tab()
    expect(reasonNow()).toBeNull()
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true')
    expect(calls.writes).toBe(0)
  })

  test('Edit opens a stored amount with no reason and Save enabled', async () => {
    await openEdit(TWO_DECIMALS)
    expect(amountField()).toHaveValue('4500,00')
    expect(reasonNow()).toBeNull()
    expect(saveButton()).not.toHaveAttribute('aria-disabled', 'true')
  })
})

test('Edit at 0 decimals opens a stored amount with no reason and Save enabled', async () => {
  await openEdit(ZERO_DECIMALS)
  expect(reasonNow()).toBeNull()
  expect(saveButton()).not.toHaveAttribute('aria-disabled', 'true')
})

test('a second tap on Save while the first is still sending sends no second request', async () => {
  let release: () => void = () => undefined
  const calls: Calls = { writes: 0, hold: new Promise<void>((resolve) => (release = resolve)) }
  await openAdd(ZERO_DECIMALS, calls)
  await userEvent.type(amountField(), '1000')
  await userEvent.click(saveButton())
  await waitFor(() => expect(calls.writes).toBe(1))
  await userEvent.click(saveButton())
  expect(calls.writes).toBe(1)
  release()
})

test('Enter with a valid amount but no category sends nothing: the submit guard covers every blocking rule', async () => {
  const calls: Calls = { writes: 0 }
  stubViewport('phone')
  renderExpenses([EXPENSE_NEW], api(calls), ZERO_DECIMALS)
  await userEvent.type(await screen.findByLabelText('Amount'), '1000{Enter}')
  await userEvent.type(screen.getByLabelText('Details (optional)'), 'x{Enter}')
  // A submit that does not come through Save's click (nothing says it must) meets the same guard.
  fireEvent.submit(amountField().form ?? amountField())
  expect(saveButton()).toHaveAttribute('aria-disabled', 'true')
  expect(calls.writes).toBe(0)
})
