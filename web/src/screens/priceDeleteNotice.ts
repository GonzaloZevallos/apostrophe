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
import type { TFunction } from 'i18next'

export interface HistoryEntry {
  id: number
  effective_from: string
  list_price: number
}

/** The caller passes its `t`, so the wording is resolved on its render and follows a language switch. */
export function deleteNotice(history: readonly HistoryEntry[], entryId: number, t: TFunction): string {
  const chronological = [...history].sort((a, b) => (a.effective_from < b.effective_from ? -1 : 1))
  const index = chronological.findIndex((entry) => entry.id === entryId)
  const earlier = index > 0 ? chronological[index - 1] : undefined
  if (earlier !== undefined) {
    return t('common:returnsTo', {
      amount: formatMoney(earlier.list_price),
      date: formatDateShort(earlier.effective_from),
    })
  }
  const next = chronological[index + 1]
  if (next !== undefined) {
    return t('common:noPriceBefore', { date: formatDateShort(next.effective_from) })
  }
  return NO_PRICE_TODAY
}
