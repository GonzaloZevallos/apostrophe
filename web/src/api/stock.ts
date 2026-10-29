/**
 * Types and calls for stock entries and the stock view (plan: `GET /stock`, `POST
 * /stock/entries`, `GET/PUT/DELETE /stock/entries/{id}`). Every call goes through
 * `api/client.ts`; no screen calls `fetch` itself.
 *
 * `quantity` on `StockEntry` and `VarietyStock` is the API's own `QuantityOut` answer — a
 * plain number by the time it lands here — and this module only ever carries it
 * through, never multiplies or rounds it (plan, invariants: "the front never shows a
 * quantity or money figure it computed after saving"). What a form submits is the
 * decimal string `parseGrams` returns: it never travels as a JS number either way.
 */

import { del, get, post, put } from './client'

/**
 * `PUT /stock/varieties/{variety_id}/threshold`'s body is `{quantity: number | null}`
 * (plan, API contract) — the one quantity value in this hexagon that travels as a plain
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
  quantity: number
  total_cost: number | null
  cost_per_gram: number | null
  note: string | null
}

export interface VarietyStock {
  variety_id: number
  quantity: number
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
  quantity: string
  total_cost?: number
  note?: string
}

export type WithdrawalReason = 'promotion' | 'own_use'

export interface WithdrawalLine {
  variety_id: number
  variety_name: string
  quantity: number
}

/** `GET/POST/PUT /stock/withdrawals…`'s answer; matches `fixtures/withdrawal.json`. */
export interface Withdrawal {
  id: number
  reason: WithdrawalReason
  date: string
  note: string | null
  total_quantity: number
  lines: WithdrawalLine[]
}

export interface WithdrawalLineInput {
  variety_id: number
  quantity: string
}

/** `reason` stays optional on the wire: a missing one is the backend's own coded refusal. */
export interface WithdrawalInput {
  reason?: WithdrawalReason
  date?: string
  note?: string
  lines: WithdrawalLineInput[]
}

export interface EntryMovement extends StockEntry {
  kind: 'entry'
}

export interface WithdrawalMovement {
  kind: 'withdrawal'
  id: number
  date: string
  reason: WithdrawalReason
  quantity: number
}

/** One row of a variety's "Stock y entradas"; matches `fixtures/movements.json`. */
export type Movement = EntryMovement | WithdrawalMovement

/** The entries of one variety, in the order the server sent them (newest first): the one
 * place the front filters `entries` by variety. */
export function entriesOf(stock: StockView, varietyId: number): StockEntry[] {
  return stock.entries.filter((entry) => entry.variety_id === varietyId)
}

export function readStock(): Promise<StockView> {
  return get<StockView>('/stock')
}

/** `GET /stock?archived=true`: the rows of the archived varieties (the read-only page's own
 * stock); `total` and `entries` are the same unfiltered ones. */
export function readArchivedStock(): Promise<StockView> {
  return get<StockView>('/stock?archived=true')
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

export function setThreshold(varietyId: number, quantity: number | null): Promise<VarietyStock> {
  return put<VarietyStock>(`/stock/varieties/${varietyId}/threshold`, { quantity })
}

export function readMovements(varietyId: string): Promise<Movement[]> {
  return get<Movement[]>(`/stock/varieties/${varietyId}/movements`)
}

export function getWithdrawal(id: string): Promise<Withdrawal> {
  return get<Withdrawal>(`/stock/withdrawals/${id}`)
}

export function recordWithdrawal(body: WithdrawalInput): Promise<Withdrawal> {
  return post<Withdrawal>('/stock/withdrawals', body)
}

export function editWithdrawal(id: string, body: WithdrawalInput): Promise<Withdrawal> {
  return put<Withdrawal>(`/stock/withdrawals/${id}`, body)
}

export function deleteWithdrawal(id: string): Promise<void> {
  return del<void>(`/stock/withdrawals/${id}`)
}
