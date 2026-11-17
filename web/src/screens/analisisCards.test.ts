/**
 * The pure mapping from `GET /analysis` rows to phone card props (`analisisCards.ts`):
 * row order per kind, rows that exist only when the API sends them, the current week and
 * the best-week mark. Every expectation is a figure the fixture or the case itself carries.
 */

import { describe, expect, test } from 'vitest'
import analysisFixture from '../api/fixtures/analysis.json'
import type { AnalysisMonthRow, AnalysisWeek, ReasonCost, RowCost, VarietyRow } from '../api/analysis'
import {
  ANALYSIS_TEXT,
  COST_OF_GOODS_LABEL,
  SHORTFALL_LABEL,
} from '../copy/analysis'
import { COMMON_TEXT } from '../copy/common'
import { formatDateShort, formatMonthLong } from '../format/dates'
import { formatGrams, moneyFormatter } from '../format/money'
import { BEST_WEEK_MARK } from './analisis/marks'
import { monthCard, varietyCard, weekCard } from './analisisCards'

const money = moneyFormatter({ symbol: '$', decimals: 0 })

const cost = (amount: number, pending = 0, all = false): RowCost => ({
  amount,
  pending_quantity: pending,
  all_pending: all,
})

const variety: VarietyRow = {
  product_id: 1,
  name: 'Flor A',
  sales_without_shipping: 90000,
  share_percent: 40,
  quantity_sold: 30,
  quantity_gifted: 2,
  cost: { costed: 20000, pending_quantity: 0 },
  margin: { amount: 70000, percent: 77, pending_quantity: 0 },
}

function reason(id: number, name: string, amount: number): ReasonCost {
  return { reason_id: id, name, amount, pending: false, pending_quantity: 0 }
}

const week: AnalysisWeek = {
  first_day: '2026-09-28',
  last_day: '2026-10-04',
  sales: 120000,
  quantity: 40,
  expenses: 5000,
  cost_of_goods: cost(30000),
  shortfall: null,
  withdrawals: [],
  profit: { amount: 85000, pending_quantity: 0 },
  cash: 70000,
  best: false,
}

describe('varietyCard', () => {
  test('rows follow the table row: share, sold, gifted, cost, margin', () => {
    const card = varietyCard(variety, money)
    expect(card.title).toBe('Flor A')
    expect(card.headline).toBe(money.money(90000))
    expect(card.rows).toEqual([
      { before: '', figure: '40', after: ANALYSIS_TEXT.delMes, pending: null },
      { before: '', figure: formatGrams(30), after: COMMON_TEXT.soldSuffix, pending: null },
      { before: '', figure: formatGrams(2), after: ANALYSIS_TEXT.regalados, pending: null },
      { before: ANALYSIS_TEXT.costo, figure: money.money(20000), after: '', pending: null },
      { before: ANALYSIS_TEXT.margen, figure: money.money(70000), after: ' (77%)', pending: null },
    ])
  })

  test('no share row and no percent when the API sends null', () => {
    const card = varietyCard({
      ...variety,
      share_percent: null,
      margin: { amount: 70000, percent: null, pending_quantity: 0 },
    }, money)
    expect(card.rows).toHaveLength(4)
    expect(card.rows[0]?.after).toBe(COMMON_TEXT.soldSuffix)
    expect(card.rows.at(-1)).toEqual({
      before: ANALYSIS_TEXT.margen,
      figure: money.money(70000),
      after: '',
      pending: null,
    })
  })

  test('cost and margin carry their own pending text apart from the figure', () => {
    const card = varietyCard({
      ...variety,
      cost: { costed: 20000, pending_quantity: 2.5 },
      margin: { amount: 70000, percent: 77, pending_quantity: 2.5 },
    }, money)
    const pending = ANALYSIS_TEXT.pendingSuffix(formatGrams(2.5))
    expect(card.rows[3]).toMatchObject({ figure: money.money(20000), pending })
    expect(card.rows[4]).toMatchObject({ figure: money.money(70000), pending })
    expect(card.rows[2]?.pending).toBeNull()
  })
})

describe('weekCard', () => {
  test('rows in order: grams, cost of goods, expenses, profit, cash', () => {
    const card = weekCard(week, false, money)
    expect(card.title).toBe(formatDateShort('2026-09-28'))
    expect(card.headline).toBe(money.money(120000))
    expect(card.rows.map((row) => [row.before, row.figure])).toEqual([
      [`${COMMON_TEXT.grams} `, formatGrams(40)],
      [`${COST_OF_GOODS_LABEL} `, money.money(30000)],
      [ANALYSIS_TEXT.gastos, money.money(5000)],
      [ANALYSIS_TEXT.ganancia, money.money(85000)],
      [ANALYSIS_TEXT.caja, money.money(70000)],
    ])
    expect(card.current).toBe(false)
    expect(card.mark).toBeUndefined()
  })

  test('shortfall and one line per reason sit after the cost, only when present', () => {
    const card = weekCard(
      { ...week, shortfall: cost(100), withdrawals: [reason(1, 'Marketing', 200), reason(2, 'Own use', 300)] },
      false,
      money,
    )
    expect(card.rows.map((row) => row.before)).toEqual([
      `${COMMON_TEXT.grams} `,
      `${COST_OF_GOODS_LABEL} `,
      `${SHORTFALL_LABEL} `,
      'Marketing ',
      'Own use ',
      ANALYSIS_TEXT.gastos,
      ANALYSIS_TEXT.ganancia,
      ANALYSIS_TEXT.caja,
    ])
    const only = weekCard({ ...week, withdrawals: [reason(1, 'Marketing', 200)] }, false, money)
    expect(only.rows.map((row) => row.before)).toContain('Marketing ')
    expect(only.rows.map((row) => row.before)).not.toContain(`${SHORTFALL_LABEL} `)
    expect(only.rows.map((row) => row.before)).not.toContain('Own use ')
  })

  test('the reason lines follow the order the API answers, whatever the names', () => {
    const card = weekCard(
      {
        ...week,
        withdrawals: [reason(3, 'Gifts', 50), reason(2, 'Own use', 300), reason(1, 'Marketing', 200)],
      },
      false,
      money,
    )
    const labels = card.rows.map((row) => row.before)
    expect(labels.slice(2, 5)).toEqual(['Gifts ', 'Own use ', 'Marketing '])
  })

  test('a fully pending cost has no figure, only its grams on the pending line', () => {
    const card = weekCard({ ...week, cost_of_goods: cost(0, 4, true) }, false, money)
    expect(card.rows[1]).toEqual({
      before: `${COST_OF_GOODS_LABEL} `,
      figure: null,
      after: '',
      pending: ANALYSIS_TEXT.noCostAlone(formatGrams(4)),
    })
  })

  test('a partly pending cost and profit keep the figure and the pending line apart', () => {
    const card = weekCard(
      { ...week, cost_of_goods: cost(30000, 2.5), profit: { amount: 85000, pending_quantity: 2.5 } },
      false,
      money,
    )
    const pending = ANALYSIS_TEXT.pendingSuffix(formatGrams(2.5))
    expect(card.rows[1]).toMatchObject({ figure: money.money(30000), pending })
    expect(card.rows[3]).toMatchObject({ figure: money.money(85000), pending })
  })

  test('current and best come from the arguments and the API', () => {
    const card = weekCard({ ...week, best: true }, true, money)
    expect(card.current).toBe(true)
    expect(card.mark).toBe(BEST_WEEK_MARK)
  })
})

describe('monthCard', () => {
  const row: AnalysisMonthRow = { ...week, month: '2026-09', first_day: '2026-09-01' }

  test('titled by the month, same rows as a week, never current nor marked', () => {
    const card = monthCard(row, money)
    expect(card.title).toBe(formatMonthLong('2026-09'))
    expect(card.headline).toBe(money.money(120000))
    expect(card.rows).toEqual(weekCard(week, false, money).rows)
    expect(card.current).toBeUndefined()
    expect(card.mark).toBeUndefined()
  })

  test('maps every fixture month', () => {
    for (const fixtureRow of analysisFixture.months) {
      expect(monthCard(fixtureRow as AnalysisMonthRow, money).rows.length).toBeGreaterThanOrEqual(5)
    }
  })
})
