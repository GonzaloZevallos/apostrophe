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

/** The quantity the sale's lines hold, gifts included (plan, "Contract":
 * `SaleDetailOut` adds `total_quantity`) — read for the delete confirmation's
 * "Vuelven N g al stock" (sales.md), never summed here from the lines. */
export type QuantityOut = number

export type Payment = 'cash' | 'transfer' | 'owing' | 'none'

export interface SaleCustomer {
  id: number
  name: string
  vip: boolean
}

export interface SaleLine {
  variety_id: number
  variety_name: string
  quantity: number
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
  still_owing: boolean
}

export function listSales(dateFrom: string, dateTo: string): Promise<Sale[]> {
  const search = `?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`
  return get<Sale[]>(`/sales${search}`)
}

/** A line's cost of goods (ADR-0009): `costed` is `null` exactly when none of the
 * line's quantity is costed yet, never a $0 standing in for "not yet known". */
export interface SaleLineCost {
  costed: number | null
  pending_quantity: number
}

export interface SaleDetailLine extends SaleLine {
  cost: SaleLineCost
}

/** Where the server's one settlement pass leaves the sale (`BillState`, ADR-0053):
 * a different fact from `Sale['payment']`, which is how the sale was paid, so
 * the two vocabularies stay apart on purpose. */
export type BillState = 'cash' | 'transfer' | 'paid' | 'owed' | 'none'

/** The pricing rules a bill line can show; a VIP or special line reads like a list
 * line, so it has none (`rule: null`). */
export type BillRule = 'bulk' | 'gift'

export interface SaleBillPayment {
  state: BillState
  still_owed: number | null
}

export interface SaleBillLine {
  product: string
  quantity: QuantityOut
  amount: number
  rule: BillRule | null
  unit_price: number | null
}

/** `SaleBillOut` (`app/sales/adapters/schemas.py`): the facts a seller may share with
 * the customer, read from the last `GET /sales/{id}` and never recomputed here. */
export interface SaleBill {
  business_name: string
  date: SaleDetail['date']
  shipping_charged: number
  total: number
  lines: SaleBillLine[]
  payment: SaleBillPayment
  balance: number | null
}

/** The key lists the contract test (`saleBillContract.test.ts`) holds equal to the
 * OpenAPI snapshot; `satisfies` ties each to its type so a renamed field fails `tsc`. */
export const SALE_BILL_KEYS = [
  'business_name',
  'date',
  'shipping_charged',
  'total',
  'lines',
  'payment',
  'balance',
] as const satisfies readonly (keyof SaleBill)[]
export const SALE_BILL_LINE_KEYS = [
  'product',
  'quantity',
  'amount',
  'rule',
  'unit_price',
] as const satisfies readonly (keyof SaleBillLine)[]
export const SALE_BILL_PAYMENT_KEYS = [
  'state',
  'still_owed',
] as const satisfies readonly (keyof SaleBillPayment)[]
export const BILL_STATES = [
  'cash',
  'transfer',
  'paid',
  'owed',
  'none',
] as const satisfies readonly BillState[]
export const BILL_RULES = ['bulk', 'gift'] as const satisfies readonly BillRule[]

export interface SaleDetail extends Omit<Sale, 'lines'> {
  lines: SaleDetailLine[]
  /** Every line's quantity summed, gifts included (sales.md: named in the delete
   * confirmation, "Vuelven N g al stock" — the front never adds this up itself). */
  total_quantity: QuantityOut
  /** The sale bill, or `null` when the server could not build one. */
  bill: SaleBill | null
}

/** The quantity a deleted sale gave back to one variety's stock. */
export interface ReturnedQuantity {
  variety_id: number
  quantity: number
}

export interface DeletedSale {
  returned: ReturnedQuantity[]
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
