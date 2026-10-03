/**
 * Types and calls for stock entries and the stock view (plan: `GET /stock`, `POST
 * /stock/entries`, `GET/PUT/DELETE /stock/entries/{id}`). Every call goes through
 * `api/client.ts`; no screen calls `fetch` itself.
 *
 * `grams` on `StockEntry` and `VarietyStock` is the API's own `GramsOut` answer — a
 * plain number by the time it lands here — and this module only ever carries it
 * through, never multiplies or rounds it (plan, invariants: "the front never shows a
 * grams or money figure it computed after saving"). What a form submits is the
 * decimal string `parseGrams` returns: it never travels as a JS number either way.
 */

import { del, get, post, put } from './client'

/**
 * `PUT /stock/varieties/{variety_id}/threshold`'s body is `{grams: number | null}`
 * (plan, API contract) — the one grams value in this hexagon that travels as a plain
 * number rather than `Grams.of`'s decimal string, since a threshold is never summed
 * or allocated, only compared. `null` turns the threshold off.
 */

export type Origin = 'purchase' | 'harvest' | 'opening_stock' | 'adjustment'
export type Status = 'no_entries' | 'sold_out' | 'low' | 'ok'

export interface StockEntry {
  id: number
  date: string
  variety_id: number
  origin: Origin
  grams: number
  total_cost: number | null
  cost_per_gram: number | null
  note: string | null
}

export interface VarietyStock {
  variety_id: number
  grams: number
  status: Status
  sold_out_since: string | null
  threshold: number | null
  days_left: number | null
}

export interface StockView {
  total: number
  varieties: VarietyStock[]
  entries: StockEntry[]
}

export interface StockEntryInput {
  date?: string
  variety_id: number
  origin: Origin
  grams: string
  total_cost?: number
  note?: string
}

export function readStock(): Promise<StockView> {
  return get<StockView>('/stock')
}

export function getEntry(id: string): Promise<StockEntry> {
  return get<StockEntry>(`/stock/entries/${id}`)
}

export function recordEntry(body: StockEntryInput): Promise<StockEntry> {
  return post<StockEntry>('/stock/entries', body)
}

export function editEntry(id: string, body: StockEntryInput): Promise<StockEntry> {
  return put<StockEntry>(`/stock/entries/${id}`, body)
}

export function deleteEntry(id: string): Promise<void> {
  return del<void>(`/stock/entries/${id}`)
}

export function setThreshold(varietyId: number, grams: number | null): Promise<VarietyStock> {
  return put<VarietyStock>(`/stock/varieties/${varietyId}/threshold`, { grams })
}
