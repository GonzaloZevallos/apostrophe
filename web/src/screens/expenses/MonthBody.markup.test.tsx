/**
 * The proof that `MonthBody`'s markup does not move while it is split into pieces: each state's
 * `innerHTML` is compared with `MonthBody.markup.test.json`, recorded from `MonthBody` before the
 * split. The fixture is never edited by a refactor.
 */

import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import type { Expense, MonthlyView } from '../../api/expenses'
import { MoneyFormatProvider } from '../../format/MoneyFormatProvider'
import MonthBody from './MonthBody'

const TODAY = '2026-10-02'

function expense(id: number, spentOn: string, amount: number, detail = '', method: Expense['payment_method'] = null): Expense {
  return { id, spent_on: spentOn, category_id: 1, amount, detail, payment_method: method }
}

const cash = { id: 4, name: 'Cash', icon: 'cash' }

interface State {
  view: MonthlyView
  withEdit: boolean
}

export const STATES: Record<string, State> = {
  'an empty month': { view: { month: '2026-10', total: 0, categories: [] }, withEdit: true },
  'one expense': {
    view: { month: '2026-10', total: 500, categories: [{ id: 1, name: 'Rent', subtotal: 500, expenses: [expense(1, '2026-10-01', 500)] }] },
    withEdit: true,
  },
  'several expenses across several categories': {
    view: {
      month: '2026-10',
      total: 1500,
      categories: [
        { id: 1, name: 'Rent', subtotal: 1000, expenses: [expense(1, '2026-10-01', 600, 'Local', cash), expense(2, '2026-10-02', 400)] },
        { id: 2, name: 'Tea', subtotal: 300, expenses: [expense(3, '2026-10-02', 300, 'Leaves')] },
        { id: 3, name: 'Gas', subtotal: 200, expenses: [expense(4, '2026-09-30', 200, '', cash)] },
      ],
    },
    withEdit: true,
  },
  'a category with a zero subtotal': {
    view: {
      month: '2026-10',
      total: 100,
      categories: [
        { id: 1, name: 'Rent', subtotal: 100, expenses: [expense(1, '2026-10-01', 100)] },
        { id: 2, name: 'Tea', subtotal: 0, expenses: [] },
      ],
    },
    withEdit: true,
  },
  'a bar width of exactly .5': {
    view: {
      month: '2026-10',
      total: 8,
      categories: [
        { id: 1, name: 'Rent', subtotal: 7, expenses: [expense(1, '2026-10-01', 7)] },
        { id: 2, name: 'Tea', subtotal: 1, expenses: [expense(2, '2026-10-01', 1)] },
      ],
    },
    withEdit: true,
  },
  'with onEdit': {
    view: { month: '2026-10', total: 40, categories: [{ id: 1, name: 'Rent', subtotal: 40, expenses: [expense(1, '2026-10-01', 40, 'Local', cash)] }] },
    withEdit: true,
  },
  'without onEdit': {
    view: { month: '2026-10', total: 40, categories: [{ id: 1, name: 'Rent', subtotal: 40, expenses: [expense(1, '2026-10-01', 40, 'Local', cash)] }] },
    withEdit: false,
  },
}

export function markupOf(state: State): string {
  const { container } = render(
    <MoneyFormatProvider format={{ symbol: '$', decimals: 0 }}>
      <MonthBody view={state.view} today={TODAY} onEdit={state.withEdit ? () => undefined : undefined} />
    </MoneyFormatProvider>,
  )
  return container.innerHTML
}

const FIXTURE = JSON.parse(readFileSync(resolve(__dirname, 'MonthBody.markup.test.json'), 'utf8')) as Record<string, string>

describe('MonthBody markup', () => {
  test.each(Object.keys(STATES))('%s is byte for byte the committed markup', (name) => {
    const state = STATES[name]
    if (state === undefined) throw new Error(name)
    expect(markupOf(state)).toBe(FIXTURE[name])
  })

  test('the fixture holds exactly the states', () => {
    expect(Object.keys(FIXTURE)).toEqual(Object.keys(STATES))
  })

  test('the .5 state rounds the bar up to 13%', () => {
    expect(FIXTURE['a bar width of exactly .5']).toContain('width: 13%')
  })

  test('the state without onEdit takes its rows out of the tab order', () => {
    expect(FIXTURE['without onEdit']).toContain('tabindex="-1"')
    expect(FIXTURE['with onEdit']).not.toContain('tabindex')
  })
})
