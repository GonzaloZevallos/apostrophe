/**
 * `GET /panel` (plan, "Answer shape"): one read model covering Hoy, Semana and Mes
 * side by side, debts and stock. Matches `web/src/api/fixtures/panel.json` and
 * `app/results/application/ports.py`'s answer shape field for field. No path, query
 * or body parameter (plan invariant): the business and "today" both come from the
 * session.
 */

import { get } from './client'
import type { VarietyStock } from './stock'

export interface PanelPeriod {
  start: string
  end: string
  sales: number
  sales_count: number
  average_sale: number | null
  grams_sold: number
  grams_gifted: number
  cost_of_goods: number
  pending_cost: boolean
  expenses: number
  purchases: number
  profit: number
  cash: number
}

/** Hoy carries only what it shows (`TodayFiguresOut`): Ganancia, Caja, Gastos,
 * Regalaste and Compras live in `week` and `month`. */
export interface PanelToday {
  start: string
  end: string
  sales: number
  sales_count: number
  grams_sold: number
}

export interface PanelPeriods {
  today: PanelToday
  week: PanelPeriod
  month: PanelPeriod
}

export type PanelTab = keyof PanelPeriods

export interface PanelDebtorTeaser {
  customer_id: number
  name: string
  balance: number
  owing_since: string
}

export interface PanelDebts {
  total_owed: number
  sales_owing_count: number
  oldest: string | null
  teaser: PanelDebtorTeaser[]
}

/** `VarietyStockOut`'s keys plus `name` (plan invariant): every other field equals
 * `GET /stock`'s own row for the same variety. */
export interface PanelVarietyOut extends VarietyStock {
  name: string
}

export type SetupStepId = 'priced_variety' | 'stock_entry' | 'bot_published' | 'partner'

export interface SetupStep {
  step: SetupStepId
  done: boolean
  required: boolean
}

/** Decided on the server (`setup_view`): the front renders the steps in this order and
 * never filters or reorders them. */
export interface PanelSetup {
  checklist: { steps: SetupStep[] } | null
  priced_today: boolean
  bot_notice: boolean
}

export interface PanelAnswer {
  periods: PanelPeriods
  debts: PanelDebts
  stock: PanelVarietyOut[]
  setup: PanelSetup
}

export function getPanel(): Promise<PanelAnswer> {
  return get<PanelAnswer>('/panel')
}
