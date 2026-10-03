/**
 * The sale resource, over `api/client.ts` only (plan, invariants): no screen calls
 * `fetch` directly. Matches `app/sales/adapters/schemas.py` field for field
 * (docs/adr/0011): `Sale` is `SaleOut` (the list and every write), `SaleDetail` is
 * `SaleDetailOut` (`GET /sales/{id}`, which adds each line's cost of goods, ADR-0009)
 * and `DeletedSale` is `DeleteSaleOut`. The read shape a screen renders, never
 * recomputed here — `sales/pricing.ts` is the preview, this module only carries
 * what the API answered.
 */

import { del, get, put } from './client'
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

/** A line's cost of goods (ADR-0009): `costed` is `null` exactly when none of the
 * line's grams is costed yet, never a $0 standing in for "not yet known". */
export interface SaleLineCost {
  costed: number | null
  pending_grams: number
}

export interface SaleDetailLine extends SaleLine {
  cost: SaleLineCost
}

export interface SaleDetail extends Omit<Sale, 'lines'> {
  lines: SaleDetailLine[]
}

/** The grams a deleted sale gave back to one variety's stock. */
export interface ReturnedGrams {
  variety_id: number
  grams: number
}

export interface DeletedSale {
  returned: ReturnedGrams[]
}

export function getSale(id: string): Promise<SaleDetail> {
  return get<SaleDetail>(`/sales/${encodeURIComponent(id)}`)
}

export function deleteSale(id: string): Promise<DeletedSale> {
  return del<DeletedSale>(`/sales/${encodeURIComponent(id)}`)
}

// `assign-customer` (`VentaDetalle`'s "Asignar cliente", only on a sale that has
// none): the one write this subtask adds, over the existing `PUT /sales/{id}/customer`
// (plan, "No new API routes are needed").
export function assignCustomer(id: string, customerId: number): Promise<Sale> {
  return put<Sale>(`/sales/${encodeURIComponent(id)}/customer`, { customer_id: customerId })
}
