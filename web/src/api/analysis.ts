/**
 * Types and the call for `GET /analysis` (plan, "Response contract"; pinned by
 * `analysis-contract` in `app/results/adapters/schemas.py`). The backend works out
 * every figure, mark, sort, share and percentage (CODING_STANDARDS.md section 10):
 * this module only mirrors that frozen shape — it computes nothing of its own.
 */

import { get } from './client'

export interface MarginFigure {
  amount: number
  percent: number | null
  pending_grams: number
}

export interface CostFigure {
  costed: number
  pending_grams: number
}

export interface AmountWithPending {
  amount: number
  pending_grams: number
}

/** One Análisis cost line (`RowCostOut`): a costed amount, the grams still without a
 * cost, and the backend's own answer on whether every gram behind the figure is
 * pending. The front never works that out itself. */
export interface RowCost {
  amount: number
  pending_grams: number
  all_pending: boolean
}

export interface VarietyRow {
  variety_id: number
  name: string
  sales_without_shipping: number
  share_percent: number | null
  grams_sold: number
  grams_gifted: number
  cost: CostFigure
  margin: MarginFigure
}

export interface AnalysisMonth {
  month: string
  previous: string | null
  next: string | null
  sales: number
  sales_without_shipping: number
  grams_sold: number
  grams_gifted: number
  average_margin: MarginFigure
  shortfall: RowCost | null
  promotion: RowCost | null
  own_use: RowCost | null
  varieties: VarietyRow[]
}

export interface AnalysisWeek {
  first_day: string
  last_day: string
  sales: number
  grams: number
  expenses: number
  cost_of_goods: RowCost
  shortfall: RowCost | null
  promotion: RowCost | null
  own_use: RowCost | null
  profit: AmountWithPending
  cash: number
  best: boolean
}

export interface AnalysisMonthRow {
  month: string
  first_day: string
  last_day: string
  sales: number
  grams: number
  expenses: number
  cost_of_goods: RowCost
  shortfall: RowCost | null
  promotion: RowCost | null
  own_use: RowCost | null
  profit: AmountWithPending
  cash: number
}

export interface AnalysisWeekday {
  weekday: number
  sales: number
  count: number
  best: boolean
}

export interface SinceFirstRecord {
  sales: number
  expenses: number
  profit: AmountWithPending
  cash: number
  shortfall: RowCost | null
  promotion: RowCost | null
  own_use: RowCost | null
}

export interface ExpenseCategoryTotal {
  category_id: number
  name: string
  total: number
}

export interface ExpenseBreakdown {
  categories: ExpenseCategoryTotal[]
  total: number
  purchases: number
}

export interface Analysis {
  today: string
  first_record: string | null
  month: AnalysisMonth
  weeks: AnalysisWeek[]
  months: AnalysisMonthRow[]
  weekdays: AnalysisWeekday[]
  since_first_record: SinceFirstRecord | null
  month_expenses: ExpenseBreakdown
  since_first_record_expenses: ExpenseBreakdown
}

/** `month` is always sent explicitly (`"YYYY-MM"`) — the screen always knows which
 * month it is showing, so it never relies on the route's own "no month" default. */
export function readAnalysis(month: string): Promise<Analysis> {
  return get<Analysis>(`/analysis?month=${month}`)
}
