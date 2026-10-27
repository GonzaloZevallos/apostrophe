/**
 * `detailFor`/`sideNoteFor`: a variety's fixed Spanish detail line and side note,
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
import { formatDate } from '../format/dates'
import { formatGrams } from '../format/money'
import { STOCK_TEXT } from '../copy/stock'
import type { Label } from '../i18n/label'

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
      return STOCK_TEXT.firstEntry
    case 'sold_out':
      return variety.sold_out_since === null
        ? STOCK_TEXT.noGrams
        : STOCK_TEXT.noGramsSince(formatDate(variety.sold_out_since, today))
    case 'low':
      return variety.threshold === null
        ? STOCK_TEXT.warnBelowThreshold
        : STOCK_TEXT.warnBelow(formatGrams(variety.threshold))
    case 'ok':
      return STOCK_TEXT.atPace
  }
}

export function sideNoteFor(variety: StockSideNoteSubject): string | null {
  // The status word is `MarcaEstado`'s, never this note's: only the days left show here.
  if (variety.days_left === null) return null
  return STOCK_TEXT.daysLeft(variety.days_left)
}

/** The warning line next to a variety's status mark (`stock.md`, "On screen"): told from
 * the same `GET /stock` row `MarcaEstado` reads, never a figure the front works out itself.
 * "Warning off" is a key the component resolves on every render (`useLabel`), so a language
 * switch re-renders it in place; the figure lines stay text until the stock area moves them. */
export function warningFor(row: StockDetailSubject & { grams: number }): Label {
  if (row.threshold === null) return { kind: 'key', key: 'common:warningOff' }
  if (row.status === 'low') return { kind: 'text', text: STOCK_TEXT.warningLow(formatGrams(row.grams)) }
  return { kind: 'text', text: STOCK_TEXT.warnMeBelow(formatGrams(row.threshold)) }
}
