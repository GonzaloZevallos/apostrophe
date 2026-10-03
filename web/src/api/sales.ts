/**
 * The sale resource, over `api/client.ts` only (plan, invariants): no screen calls
 * `fetch` directly. Matches `app/sales/adapters/schemas.py`'s `SaleOut` field for
 * field (docs/adr/0009): the read shape a screen renders, never recomputed here —
 * `sales/pricing.ts` is the preview, this module only carries what the API answered.
 */

import { del, get } from './client'
import type { PricingRule } from '../sales/pricing'

export type Payment = 'cash' | 'transfer' | 'owing' | 'none'

export interface SaleCustomer {
  id: number
  name: string
  vip: boolean
}

export interface SaleLine {
  variety_id: number
  variety_name: string
  grams: number
  pricing_rule: PricingRule
  price_per_gram: number
  line_total: number
}

export interface Sale {
  id: number
  date: string
  customer: SaleCustomer | null
  shipping_charged: number
  note: string | null
  payment: Payment
  total: number
  lines: SaleLine[]
}

export function listSales(dateFrom: string, dateTo: string): Promise<Sale[]> {
  const search = `?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`
  return get<Sale[]>(`/sales${search}`)
}

export function getSale(id: string): Promise<Sale> {
  return get<Sale>(`/sales/${encodeURIComponent(id)}`)
}

export function deleteSale(id: string): Promise<void> {
  return del<void>(`/sales/${encodeURIComponent(id)}`)
}
