/**
 * `GET /panel` (plan, "Answer shape"): one read model covering Hoy, Semana and Mes
 * side by side, debts and stock. Matches `web/src/api/fixtures/panel.json` and
 * `app/results/application/ports.py`'s answer shape field for field. No path, query
 * or body parameter (plan invariant): the business and "today" both come from the
 * session.
 */

import { get } from './client'
import type { VarietyStock } from './stock'

/** A period's stock shortfall, promotion or own-use cost (CONTEXT.md), `null` exactly
 * when the period has none of that line's records. `pending` is decided from that
 * line's own pending grams (plan invariant); no grams cross the wire (PM). Twin of
 * `CostLineOut`. */
export interface PanelCostLine {
  amount: number
  pending: boolean
}

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
  shortfall: PanelCostLine | null
  promotion: PanelCostLine | null
  own_use: PanelCostLine | null
  expenses: number
  purchases: number
  profit: number
  profit_pending: boolean
  cash: number
}

export interface PanelPeriods {
  today: PanelPeriod
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

export interface PanelAnswer {
  periods: PanelPeriods
  debts: PanelDebts
  stock: PanelVarietyOut[]
}

export function getPanel(): Promise<PanelAnswer> {
  return get<PanelAnswer>('/panel')
}
