/**
 * `summaryLine` (`varieties.md`, "The list"): the one line above Variedades' list, counted
 * from the statuses `GET /stock` answered and from nothing else. No varieties: none (the
 * list shows its empty state instead); every one ok: "N varieties · all ok"; otherwise
 * each status that is not ok, counted by word, in stock-status order. Never blank.
 */

import type { Status } from '../api/stock'
import { STATUS_LOW, STATUS_NO_ENTRIES, STATUS_SOLD_OUT, varietiesAllOk } from '../copy/common'

/** Stock-status order (`stock.md`), `ok` left out: it is never counted on its own. */
const COUNTED: readonly { status: Status; one: string; many: string }[] = [
  { status: 'no_entries', one: STATUS_NO_ENTRIES, many: STATUS_NO_ENTRIES },
  { status: 'sold_out', one: STATUS_SOLD_OUT, many: STATUS_SOLD_OUT },
  { status: 'low', one: STATUS_LOW, many: STATUS_LOW },
]

export function summaryLine(statuses: readonly Status[]): string | null {
  if (statuses.length === 0) return null
  const parts = COUNTED.flatMap(({ status, one, many }) => {
    const count = statuses.filter((candidate) => candidate === status).length
    return count === 0 ? [] : [`${count} ${count === 1 ? one : many}`]
  })
  if (parts.length > 0) return parts.join(' · ')
  return varietiesAllOk(statuses.length)
}
