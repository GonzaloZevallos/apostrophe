/**
 * The "Antes de borrar" confirmation wording for a price entry (`varieties.md`,
 * "Deleting an entry"): what takes the deleted entry's place, worked out from its
 * position in the chronological history alone — never from "today" — so deleting an
 * old entry or the one in force today reads the same way. The copy never mentions
 * sales (ADR-0003).
 */

import { formatDateShort } from '../format/dates'
import { formatMoney } from '../format/money'
import { NO_PRICE_TODAY } from './Variedades'
import { COMMON_TEXT } from '../copy/common'

export interface HistoryEntry {
  id: number
  effective_from: string
  list_price: number
}

export function deleteNotice(history: readonly HistoryEntry[], entryId: number): string {
  const chronological = [...history].sort((a, b) => (a.effective_from < b.effective_from ? -1 : 1))
  const index = chronological.findIndex((entry) => entry.id === entryId)
  const earlier = index > 0 ? chronological[index - 1] : undefined
  if (earlier !== undefined) {
    return COMMON_TEXT.vuelveARegir0(formatMoney(earlier.list_price), formatDateShort(earlier.effective_from))
  }
  const next = chronological[index + 1]
  if (next !== undefined) {
    return COMMON_TEXT.noVaAHaber(formatDateShort(next.effective_from))
  }
  return NO_PRICE_TODAY
}
