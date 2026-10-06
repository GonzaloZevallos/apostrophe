/**
 * `summaryLine` (`varieties.md`, "The list"): the one line above Variedades' list, counted
 * from the statuses `GET /stock` answered and from nothing else. No varieties: none (the
 * list shows its empty state instead); every one ok: "N variedades · todo ok"; otherwise
 * each status that is not ok, counted by word, in stock-status order. Never blank.
 */

import type { Status } from '../api/stock'

/** Stock-status order (`stock.md`), `ok` left out: it is never counted on its own. */
const COUNTED: readonly { status: Status; one: string; many: string }[] = [
  { status: 'no_entries', one: 'sin entradas', many: 'sin entradas' },
  { status: 'sold_out', one: 'agotada', many: 'agotadas' },
  { status: 'low', one: 'baja', many: 'bajas' },
]

export function summaryLine(statuses: readonly Status[]): string | null {
  if (statuses.length === 0) return null
  const parts = COUNTED.flatMap(({ status, one, many }) => {
    const count = statuses.filter((candidate) => candidate === status).length
    return count === 0 ? [] : [`${count} ${count === 1 ? one : many}`]
  })
  if (parts.length > 0) return parts.join(' · ')
  return `${statuses.length} ${statuses.length === 1 ? 'variedad' : 'variedades'} · todo ok`
}
