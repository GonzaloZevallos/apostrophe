import { describe, expect, test } from 'vitest'
import type { Expense, MonthlyView } from '../../api/expenses'
import { expenseOrder, latestExpenses, mutedLine, shortAmount, summarize } from './expensesSummary'

/** A month view from flat `id, name, subtotal` triples. */
function viewOf(...cells: (number | string)[]): MonthlyView {
  const categories: MonthlyView['categories'] = []
  for (let at = 0; at < cells.length; at += 3) {
    const [id, name, subtotal] = [cells[at], cells[at + 1], cells[at + 2]]
    if (typeof id !== 'number' || typeof name !== 'string' || typeof subtotal !== 'number') throw new Error('bad row')
    categories.push({ id, name, subtotal, expenses: [] })
  }
  // A total that is wrong on purpose: summarize must never read it.
  return { month: '2026-11', total: 999999, categories }
}

function expense(id: number, spentOn: string, method: Expense['payment_method'] = null): Expense {
  return { id, spent_on: spentOn, category_id: 1, amount: 10, detail: '', payment_method: method }
}

type Seg = { key: number | 'others'; name: string | null; amount: number; percent: number; colorIndex: 0 | 1 | 2 | 'others' }

const seg = (key: Seg['key'], name: string | null, amount: number, percent: number, colorIndex: Seg['colorIndex']): Seg => ({
  key,
  name,
  amount,
  percent,
  colorIndex,
})

describe('summarize', () => {
  const rows: [string, MonthlyView, number, number, Seg[]][] = [
    ['a tie goes by name in code-point order, Zeta before alpha', viewOf(1, 'alpha', 50, 2, 'Zeta', 50), 0, 100, [
      seg(2, 'Zeta', 50, 50, 0),
      seg(1, 'alpha', 50, 50, 1),
    ]],
    ['a full tie goes by id', viewOf(7, 'Rent', 10, 3, 'Rent', 10), 0, 20, [seg(3, 'Rent', 10, 50, 0), seg(7, 'Rent', 10, 50, 1)]],
    ['exactly 3 categories have no Others', viewOf(1, 'A', 50, 2, 'B', 30, 3, 'C', 20), 0, 100, [
      seg(1, 'A', 50, 50, 0),
      seg(2, 'B', 30, 30, 1),
      seg(3, 'C', 20, 20, 2),
    ]],
    ['exactly 4 categories: the fourth alone becomes Others', viewOf(1, 'A', 50, 2, 'B', 30, 3, 'C', 15, 4, 'D', 5), 0, 100, [
      seg(1, 'A', 50, 50, 0),
      seg(2, 'B', 30, 30, 1),
      seg(3, 'C', 15, 15, 2),
      seg('others', null, 5, 5, 'others'),
    ]],
    ['5 categories: the fourth and fifth sum into Others', viewOf(5, 'E', 5, 1, 'A', 40, 2, 'B', 30, 3, 'C', 15, 4, 'D', 10), 0, 100, [
      seg(1, 'A', 40, 40, 0),
      seg(2, 'B', 30, 30, 1),
      seg(3, 'C', 15, 15, 2),
      seg('others', null, 15, 15, 'others'),
    ]],
    ['a single category', viewOf(1, 'Rent', 1234), 0, 1234, [seg(1, 'Rent', 1234, 100, 0)]],
    ['a 0.4% category keeps its segment with percent 0', viewOf(1, 'Rent', 996, 2, 'Tea', 4), 0, 1000, [
      seg(1, 'Rent', 996, 100, 0),
      seg(2, 'Tea', 4, 0, 1),
    ]],
    ['70.5% rounds half up to 71', viewOf(1, 'Rent', 141, 2, 'Tea', 59), 0, 200, [
      seg(1, 'Rent', 141, 71, 0),
      seg(2, 'Tea', 59, 30, 1),
    ]],
    ['a zero total gives no segments', viewOf(1, 'Rent', 0, 2, 'Tea', 0), 0, 0, []],
    ['no categories give no segments', viewOf(), 0, 0, []],
    ['zero-amount categories are dropped', viewOf(1, 'Rent', 0, 2, 'Tea', 10, 3, 'Gas', 0), 0, 10, [seg(2, 'Tea', 10, 100, 0)]],
    ['percentages are never adjusted to sum to 100', viewOf(1, 'A', 1, 2, 'B', 1, 3, 'C', 1), 0, 3, [
      seg(1, 'A', 1, 33, 0),
      seg(2, 'B', 1, 33, 1),
      seg(3, 'C', 1, 33, 2),
    ]],
    ['2 decimals: float-hostile amounts stay exact', viewOf(1, 'A', 0.29, 2, 'B', 4.35, 3, 'C', 1.01, 4, 'D', 0.07), 2, 5.72, [
      seg(2, 'B', 4.35, 76, 0),
      seg(3, 'C', 1.01, 18, 1),
      seg(1, 'A', 0.29, 5, 2),
      seg('others', null, 0.07, 1, 'others'),
    ]],
  ]

  test.each(rows)('%s', (_name, view, decimals, total, segments) => {
    const summary = summarize(view, decimals)
    const fields = summary.segments.map(({ key, name, amount, percent, colorIndex }) => ({ key, name, amount, percent, colorIndex }))
    expect({ total: summary.total, segments: fields }).toEqual({ total, segments })
  })

  test.each(rows)('%s: the shares sum to 1 within 1e-9', (_name, view, decimals) => {
    const { segments } = summarize(view, decimals)
    if (segments.length === 0) return
    expect(Math.abs(segments.reduce((sum, segment) => sum + segment.share, 0) - 1)).toBeLessThan(1e-9)
  })
})

describe('summarize: share and short', () => {
  const shares = (view: MonthlyView, decimals: number) =>
    summarize(view, decimals).segments.map(({ key, share, short }) => ({ key, share, short }))

  test('a single category has share 1', () => {
    expect(shares(viewOf(1, 'Rent', 1234), 0)).toEqual([{ key: 1, share: 1, short: { unit: 'thousand', value: 1 } }])
  })

  test('the share is the exact fraction, never adjusted', () => {
    expect(shares(viewOf(1, 'A', 1, 2, 'B', 1, 3, 'C', 1), 0).map((segment) => segment.share)).toEqual([1 / 3, 1 / 3, 1 / 3])
    expect(shares(viewOf(1, 'Rent', 141, 2, 'Tea', 59), 0).map((segment) => segment.share)).toEqual([0.705, 0.295])
  })

  test('Others carries the share and short amount of the summed rest', () => {
    const view = viewOf(1, 'A', 5000, 2, 'B', 3000, 3, 'C', 1500, 4, 'D', 400, 5, 'E', 100)
    const others = summarize(view, 0).segments.find((segment) => segment.key === 'others')
    expect(others?.share).toBe(500 / 10000)
    expect(others?.short).toEqual({ unit: 'none', value: 500 })
    expect(others?.percent).toBe(5)
  })

  test('every segment reads its own short amount', () => {
    const view = viewOf(1, 'A', 1500000, 2, 'B', 2500, 3, 'C', 40)
    expect(shares(view, 0).map((segment) => segment.short)).toEqual([
      { unit: 'million', value: 15 },
      { unit: 'thousand', value: 3 },
      { unit: 'none', value: 40 },
    ])
  })

  test('with 2 decimals the short amount and the share come from the same minor units', () => {
    const view = viewOf(1, 'A', 999.5, 2, 'B', 0.5)
    expect(shares(view, 2)).toEqual([
      { key: 1, share: 99950 / 100000, short: { unit: 'none', value: 999.5 } },
      { key: 2, share: 50 / 100000, short: { unit: 'none', value: 0.5 } },
    ])
  })

  test('a tie keeps equal shares in rank order', () => {
    expect(shares(viewOf(1, 'alpha', 50, 2, 'Zeta', 50), 0).map((segment) => [segment.key, segment.share])).toEqual([
      [2, 0.5],
      [1, 0.5],
    ])
  })
})

describe('latestExpenses', () => {
  const category = (id: number, name: string, expenses: Expense[]): MonthlyView['categories'][number] => ({
    id,
    name,
    subtotal: expenses.length,
    expenses,
  })
  const view = (...categories: MonthlyView['categories']): MonthlyView => ({ month: '2026-11', total: 0, categories })

  test('orders newest date first, then the higher id, across categories', () => {
    const rows = latestExpenses(
      view(
        category(1, 'Rent', [expense(1, '2026-11-01'), expense(5, '2026-11-20')]),
        category(2, 'Tea', [expense(3, '2026-11-20'), expense(9, '2026-10-30')]),
      ),
    )
    expect(rows.map((row) => [row.expense.id, row.categoryName])).toEqual([
      [5, 'Rent'],
      [3, 'Tea'],
      [1, 'Rent'],
      [9, 'Tea'],
    ])
  })

  test('equal dates with different ids put the higher id first', () => {
    const rows = latestExpenses(view(category(1, 'Rent', [expense(2, '2026-11-20'), expense(7, '2026-11-20')])))
    expect(rows.map((row) => row.expense.id)).toEqual([7, 2])
  })

  test('is empty for a month with no expenses', () => {
    expect(latestExpenses(view(category(1, 'Rent', [])))).toEqual([])
    expect(latestExpenses(view())).toEqual([])
  })
})

describe('shortAmount', () => {
  test.each([
    [999, 0, { unit: 'none', value: 999 }],
    [0, 0, { unit: 'none', value: 0 }],
    [1000, 0, { unit: 'thousand', value: 1 }],
    [1499, 0, { unit: 'thousand', value: 1 }],
    [1500, 0, { unit: 'thousand', value: 2 }],
    [999499, 0, { unit: 'thousand', value: 999 }],
    [999500, 0, { unit: 'million', value: 10 }],
    [999600, 0, { unit: 'million', value: 10 }],
    [1000000, 0, { unit: 'million', value: 10 }],
    [1234567890, 0, { unit: 'million', value: 12346 }],
    [999999.6, 2, { unit: 'million', value: 10 }],
    [999.6, 2, { unit: 'none', value: 999.6 }],
    [1000, 2, { unit: 'thousand', value: 1 }],
  ])('%s at %s decimals reads %j', (amount, decimals, expected) => {
    expect(shortAmount(amount, decimals)).toEqual(expected)
  })
})

describe('expenseOrder', () => {
  test('puts the newest date first, then the higher id', () => {
    const rows = [expense(1, '2026-11-01'), expense(5, '2026-11-20'), expense(3, '2026-11-20'), expense(9, '2026-10-30')]
    expect([...rows].sort(expenseOrder).map((row) => row.id)).toEqual([5, 3, 1, 9])
  })

  test('is zero only for the same expense', () => {
    expect(expenseOrder(expense(2, '2026-11-01'), expense(2, '2026-11-01'))).toBe(0)
  })
})

describe('mutedLine', () => {
  const today = '2026-11-26'

  test('is category, day and method, with no separators', () => {
    const method = { id: 4, name: 'Cash', icon: 'cash' }
    expect(mutedLine(expense(1, '2026-11-25', method), 'Rent', today)).toEqual([
      { kind: 'category', name: 'Rent' },
      { kind: 'day', day: { kind: 'weekday', weekday: 2, date: '25/11' } },
      { kind: 'method', name: 'Cash' },
    ])
  })

  test('adds no method part when there is none', () => {
    expect(mutedLine(expense(1, today), 'Rent', today)).toEqual([
      { kind: 'category', name: 'Rent' },
      { kind: 'day', day: { kind: 'today' } },
    ])
  })
})
