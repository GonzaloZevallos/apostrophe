/**
 * `detailFor`/`sideNoteFor`: a variety's fixed Spanish detail line and side badge,
 * from its stock status alone (`stock.md`, "On screen"). Shared by `Stock` and
 * `Inicio` (the panel's own "Lo que te queda", `results.md`) — moved here from
 * `Stock.tsx` so neither screen keeps its own copy of the same mapping (plan,
 * "Front": "Move `detailFor`/`sideNoteFor` from `Stock.tsx` to
 * `web/src/stock/detail.ts`, shared with Inicio").
 *
 * Structural (not `VarietyStock` itself) so `PanelVarietyOut` — `VarietyStockOut`'s
 * keys plus `name` (plan invariant) — satisfies it with no cast: both carry exactly
 * the fields these two functions read.
 */

import type { Status } from '../api/stock'
import {
  AT_THE_PACE,
  daysLeft,
  FIRST_ENTRY_HINT,
  NO_GRAMS,
  noGramsSince,
  STATUS_NO_ENTRIES,
  STATUS_SOLD_OUT,
  WARNING_OFF,
  warningLow,
  warnMeBelow,
  warnsBelow,
  WARNS_BELOW_THRESHOLD,
} from '../copy/common'
import { formatDate } from '../format/dates'
import { formatGrams } from '../format/money'

export interface StockDetailSubject {
  status: Status
  sold_out_since: string | null
  threshold: number | null
}

export interface StockSideNoteSubject {
  status: Status
  days_left: number | null
}

export function detailFor(variety: StockDetailSubject, today: string): string {
  switch (variety.status) {
    case 'no_entries':
      return FIRST_ENTRY_HINT
    case 'sold_out':
      return variety.sold_out_since === null
        ? NO_GRAMS
        : noGramsSince(formatDate(variety.sold_out_since, today))
    case 'low':
      return variety.threshold === null
        ? WARNS_BELOW_THRESHOLD
        : warnsBelow(formatGrams(variety.threshold))
    case 'ok':
      return AT_THE_PACE
  }
}

export function sideNoteFor(variety: StockSideNoteSubject): string | null {
  // "sold out" is a visible word on its own right here (PRD: "the inverted chip, not
  // red"), not only the one MarcaEstado keeps for screen readers — a sold-out variety
  // never has a `days_left` to fall back on, so it must be checked before that.
  if (variety.status === 'sold_out') return STATUS_SOLD_OUT
  if (variety.status === 'no_entries') return STATUS_NO_ENTRIES
  if (variety.days_left === null) return null
  return daysLeft(variety.days_left)
}

/** The warning line next to a variety's status mark (`stock.md`, "On screen"): told from
 * the same `GET /stock` row `MarcaEstado` reads, never a figure the front works out itself. */
export function warningFor(row: StockDetailSubject & { grams: number }): string {
  if (row.threshold === null) return WARNING_OFF
  if (row.status === 'low') return warningLow(formatGrams(row.grams))
  return warnMeBelow(formatGrams(row.threshold))
}
