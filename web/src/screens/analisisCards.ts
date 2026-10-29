/**
 * The phone's cards as data (`AnalisisTarjeta`): pure functions from the API's rows to what
 * a card draws, in the order of the table row each one replaces. Every label is an existing
 * copy key; every figure and pending text comes from `rowCostParts` / `amountParts`, so a
 * cost the backend says is entirely pending has no figure, only its grams on the pending
 * line. Nothing here adds, compares or sorts an amount (CODING_STANDARDS.md section 10).
 */

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
import { type AmountParts, amountParts, rowCostParts } from './analisisCost'

/** One line of a card: the words before the figure, the figure (the only span that never
 * wraps; `null` when everything behind it is pending), the words after it, and the pending
 * text, which sits on a line of its own under the figure. Copy keys keep their own spaces. */
export type CardRow = {
  before: string
  figure: string | null
  after: string
  pending: string | null
}

export type CardProps = {
  title: string
  headline: string
  rows: CardRow[]
  current?: boolean
  mark?: string
}

function row(before: string, parts: AmountParts, after = ''): CardRow {
  return {
    before,
    figure: parts.amount,
    after,
    pending: parts.marker === '' ? null : parts.marker,
  }
}

const plain = (figure: string, before = '', after = ''): CardRow => ({
  before,
  figure,
  after,
  pending: null,
})

export function varietyCard(variety: VarietyRow): CardProps {
  const rows: CardRow[] = []
  if (variety.share_percent !== null) {
    rows.push(plain(String(variety.share_percent), '', ANALYSIS_TEXT.delMes))
  }
  rows.push(
    plain(formatGrams(variety.grams_sold), '', COMMON_TEXT.soldSuffix),
    plain(formatGrams(variety.grams_gifted), '', ANALYSIS_TEXT.regalados),
    row(ANALYSIS_TEXT.costo, amountParts(variety.cost.costed, variety.cost.pending_grams)),
    row(
      ANALYSIS_TEXT.margen,
      amountParts(variety.margin.amount, variety.margin.pending_grams),
      variety.margin.percent !== null ? ` (${variety.margin.percent}%)` : '',
    ),
  )
  return {
    title: variety.name,
    headline: formatMoney(variety.sales_without_shipping),
    rows,
  }
}

type Period = AnalysisWeek | AnalysisMonthRow

function periodRows(period: Period): CardRow[] {
  const optional = (label: string, cost: RowCost | null): CardRow[] =>
    cost === null ? [] : [row(`${label} `, rowCostParts(cost))]
  return [
    plain(formatGrams(period.grams), `${COMMON_TEXT.grams} `),
    row(`${COST_OF_GOODS_LABEL} `, rowCostParts(period.cost_of_goods)),
    ...optional(SHORTFALL_LABEL, period.shortfall),
    ...optional(PROMOTION_LABEL, period.promotion),
    ...optional(OWN_USE_LABEL, period.own_use),
    plain(formatMoney(period.expenses), ANALYSIS_TEXT.gastos),
    row(ANALYSIS_TEXT.ganancia, amountParts(period.profit.amount, period.profit.pending_grams)),
    plain(formatMoney(period.cash), ANALYSIS_TEXT.caja),
  ]
}

/** `current` is the position of the week in the list (the last one), which the screen
 * knows; `best` is the backend's answer. */
export function weekCard(week: AnalysisWeek, current: boolean): CardProps {
  return {
    title: formatDateShort(week.first_day),
    headline: formatMoney(week.sales),
    rows: periodRows(week),
    current,
    ...(week.best ? { mark: BEST_WEEK_MARK } : {}),
  }
}

export function monthCard(month: AnalysisMonthRow): CardProps {
  return {
    title: formatMonthLong(month.month),
    headline: formatMoney(month.sales),
    rows: periodRows(month),
  }
}
