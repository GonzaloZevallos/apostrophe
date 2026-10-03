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
      return 'Cargale la primera entrada'
    case 'sold_out':
      return variety.sold_out_since === null
        ? 'Sin gramos'
        : `Sin gramos desde el ${formatDate(variety.sold_out_since, today)}`
    case 'low':
      return variety.threshold === null
        ? 'Avisás por debajo del umbral'
        : `Avisás abajo de ${formatGrams(variety.threshold)}`
    case 'ok':
      return 'Al ritmo de los últimos 30 días'
  }
}

export function sideNoteFor(variety: StockSideNoteSubject): string | null {
  // "agotada" is a visible word on its own right here (PRD: "the inverted chip, not
  // red"), not only the one MarcaEstado keeps for screen readers — a sold-out variety
  // never has a `days_left` to fall back on, so it must be checked before that.
  if (variety.status === 'sold_out') return 'agotada'
  if (variety.status === 'no_entries') return 'sin entradas'
  if (variety.days_left === null) return null
  return `${variety.days_left} días`
}
