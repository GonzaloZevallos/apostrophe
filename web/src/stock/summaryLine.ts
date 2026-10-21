/**
 * `summaryLine` (`varieties.md`, "The list"): the one line above Variedades' list, counted
 * from the statuses `GET /stock` answered and from nothing else. No varieties: none (the
 * list shows its empty state instead); every one ok: "N variedades · todo ok"; otherwise
 * each status that is not ok, counted by word, in stock-status order. Never blank.
 */

import type { Status } from '../api/stock'
import { STOCK_TEXT } from '../copy/stock'

/** Stock-status order (`stock.md`), `ok` left out: it is never counted on its own. */
const COUNTED: readonly { status: Status; one: string; many: string }[] = [
  { status: 'no_entries', one: STOCK_TEXT.statusNoEntries, many: STOCK_TEXT.statusNoEntries },
  { status: 'sold_out', one: STOCK_TEXT.statusSoldOut, many: STOCK_TEXT.statusSoldOutMany },
  { status: 'low', one: STOCK_TEXT.statusLow, many: STOCK_TEXT.statusLowMany },
]

export function summaryLine(statuses: readonly Status[]): string | null {
  if (statuses.length === 0) return null
  const parts = COUNTED.flatMap(({ status, one, many }) => {
    const count = statuses.filter((candidate) => candidate === status).length
    return count === 0 ? [] : [`${count} ${count === 1 ? one : many}`]
  })
  if (parts.length > 0) return parts.join(' · ')
  return `${statuses.length} ${statuses.length === 1 ? STOCK_TEXT.varietyOne : STOCK_TEXT.varietyMany}${STOCK_TEXT.allOkSuffix}`
}
