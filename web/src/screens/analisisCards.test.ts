/**
 * The pure mapping from `GET /analysis` rows to phone card props (`analisisCards.ts`):
 * row order per kind, rows that exist only when the API sends them, the current week and
 * the best-week mark. Every expectation is a figure the fixture or the case itself carries.
 */

import { describe, expect, test } from 'vitest'
import analysisFixture from '../api/fixtures/analysis.json'
import type { AnalysisMonthRow, AnalysisWeek, RowCost, VarietyRow } from '../api/analysis'
import {
  ANALYSIS_TEXT,
  COST_OF_GOODS_LABEL,
  OWN_USE_LABEL,
  PROMOTION_LABEL,
  SHORTFALL_LABEL,
} from '../copy/analysis'
import { COMMON_TEXT } from '../copy/common'
import { formatDateShort, formatMonthLong } from '../format/dates'
import { formatGrams, formatMoney } from '../format/money'
import { BEST_WEEK_MARK } from './analisis/marks'
import { monthCard, varietyCard, weekCard } from './analisisCards'

const cost = (amount: number, pending = 0, all = false): RowCost => ({
  amount,
  pending_quantity: pending,
  all_pending: all,
})

const variety: VarietyRow = {
  variety_id: 1,
  name: 'Flor A',
  sales_without_shipping: 90000,
  share_percent: 40,
  quantity_sold: 30,
  quantity_gifted: 2,
  cost: { costed: 20000, pending_quantity: 0 },
  margin: { amount: 70000, percent: 77, pending_quantity: 0 },
}

const week: AnalysisWeek = {
  first_day: '2026-09-28',
  last_day: '2026-10-04',
  sales: 120000,
  quantity: 40,
  expenses: 5000,
  cost_of_goods: cost(30000),
  shortfall: null,
  promotion: null,
  own_use: null,
  profit: { amount: 85000, pending_quantity: 0 },
  cash: 70000,
  best: false,
}

describe('varietyCard', () => {
  test('rows follow the table row: share, sold, gifted, cost, margin', () => {
    const card = varietyCard(variety)
    expect(card.title).toBe('Flor A')
    expect(card.headline).toBe(formatMoney(90000))
    expect(card.rows).toEqual([
      { before: '', figure: '40', after: ANALYSIS_TEXT.delMes, pending: null },
      { before: '', figure: formatGrams(30), after: COMMON_TEXT.soldSuffix, pending: null },
      { before: '', figure: formatGrams(2), after: ANALYSIS_TEXT.regalados, pending: null },
      { before: ANALYSIS_TEXT.costo, figure: formatMoney(20000), after: '', pending: null },
      { before: ANALYSIS_TEXT.margen, figure: formatMoney(70000), after: ' (77%)', pending: null },
    ])
  })

  test('no share row and no percent when the API sends null', () => {
    const card = varietyCard({
      ...variety,
      share_percent: null,
      margin: { amount: 70000, percent: null, pending_quantity: 0 },
    })
    expect(card.rows).toHaveLength(4)
    expect(card.rows[0]?.after).toBe(COMMON_TEXT.soldSuffix)
    expect(card.rows.at(-1)).toEqual({
      before: ANALYSIS_TEXT.margen,
      figure: formatMoney(70000),
      after: '',
      pending: null,
    })
  })

  test('cost and margin carry their own pending text apart from the figure', () => {
    const card = varietyCard({
      ...variety,
      cost: { costed: 20000, pending_quantity: 2.5 },
      margin: { amount: 70000, percent: 77, pending_quantity: 2.5 },
    })
    const pending = ANALYSIS_TEXT.pendingSuffix(formatGrams(2.5))
    expect(card.rows[3]).toMatchObject({ figure: formatMoney(20000), pending })
    expect(card.rows[4]).toMatchObject({ figure: formatMoney(70000), pending })
    expect(card.rows[2]?.pending).toBeNull()
  })
})

describe('weekCard', () => {
  test('rows in order: grams, cost of goods, expenses, profit, cash', () => {
    const card = weekCard(week, false)
    expect(card.title).toBe(formatDateShort('2026-09-28'))
    expect(card.headline).toBe(formatMoney(120000))
    expect(card.rows.map((row) => [row.before, row.figure])).toEqual([
      [`${COMMON_TEXT.grams} `, formatGrams(40)],
      [`${COST_OF_GOODS_LABEL} `, formatMoney(30000)],
      [ANALYSIS_TEXT.gastos, formatMoney(5000)],
      [ANALYSIS_TEXT.ganancia, formatMoney(85000)],
      [ANALYSIS_TEXT.caja, formatMoney(70000)],
    ])
    expect(card.current).toBe(false)
    expect(card.mark).toBeUndefined()
  })

  test('shortfall, promotion and own use sit after the cost, only when present', () => {
    const card = weekCard(
      { ...week, shortfall: cost(100), promotion: cost(200), own_use: cost(300) },
      false,
    )
    expect(card.rows.map((row) => row.before)).toEqual([
      `${COMMON_TEXT.grams} `,
      `${COST_OF_GOODS_LABEL} `,
      `${SHORTFALL_LABEL} `,
      `${PROMOTION_LABEL} `,
      `${OWN_USE_LABEL} `,
      ANALYSIS_TEXT.gastos,
      ANALYSIS_TEXT.ganancia,
      ANALYSIS_TEXT.caja,
    ])
    const only = weekCard({ ...week, promotion: cost(200) }, false)
    expect(only.rows.map((row) => row.before)).toContain(`${PROMOTION_LABEL} `)
    expect(only.rows.map((row) => row.before)).not.toContain(`${SHORTFALL_LABEL} `)
    expect(only.rows.map((row) => row.before)).not.toContain(`${OWN_USE_LABEL} `)
  })

  test('a fully pending cost has no figure, only its grams on the pending line', () => {
    const card = weekCard({ ...week, cost_of_goods: cost(0, 4, true) }, false)
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
    )
    const pending = ANALYSIS_TEXT.pendingSuffix(formatGrams(2.5))
    expect(card.rows[1]).toMatchObject({ figure: formatMoney(30000), pending })
    expect(card.rows[3]).toMatchObject({ figure: formatMoney(85000), pending })
  })

  test('current and best come from the arguments and the API', () => {
    const card = weekCard({ ...week, best: true }, true)
    expect(card.current).toBe(true)
    expect(card.mark).toBe(BEST_WEEK_MARK)
  })
})

describe('monthCard', () => {
  const row: AnalysisMonthRow = { ...week, month: '2026-09', first_day: '2026-09-01' }

  test('titled by the month, same rows as a week, never current nor marked', () => {
    const card = monthCard(row)
    expect(card.title).toBe(formatMonthLong('2026-09'))
    expect(card.headline).toBe(formatMoney(120000))
    expect(card.rows).toEqual(weekCard(week, false).rows)
    expect(card.current).toBeUndefined()
    expect(card.mark).toBeUndefined()
  })

  test('maps every fixture month', () => {
    for (const fixtureRow of analysisFixture.months) {
      expect(monthCard(fixtureRow as AnalysisMonthRow).rows.length).toBeGreaterThanOrEqual(5)
    }
  })
})
