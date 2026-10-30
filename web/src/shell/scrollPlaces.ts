/**
 * Where each screen of the open tab was scrolled when the seller left it, and what was decided
 * on arriving at each history entry (navigation.md, "Scroll on arrival and return", GH-480).
 * The offsets are numbers in this module's memory keyed by the history entry's `location.key`,
 * capped at `PLACES_CAP` keys: never in `localStorage`, `sessionStorage`, history state or a
 * URL, and they hold no business data (§9). A reload empties them.
 *
 * `held` is the offset the page had when a sheet or a screen was drawn over it. While the page
 * is pinned (a sheet is open, `html:has(.sheet)`, or a form fixes it, `html.html--formulario-fijo`)
 * `window.scrollY` reads the pinned value, not the seller's place, so the offset saved for the
 * entry being left is `held` from that same arrival and never the live reading. `held` has one
 * writer: `recordChange`, through `nextPlaces`, called by `watchScroll` on each location change.
 */

import type { NavigationType, ScrollDecision } from './scrollOnArrival'

export type Places = ReadonlyMap<string, number>

/** How many history keys the memory holds: Chromium keeps at most 50 entries, so no reachable one is dropped. */
export const PLACES_CAP = 100

/**
 * The offsets and `held` after the location changed from `prevKey` to `nextKey`.
 *   - The offset saved for the entry being left is `pinned ? held : liveScrollY`; when that is
 *     undefined nothing is saved for it.
 *   - The new `held` is that offset only when the change keeps the page and draws over it
 *     (`overPage`: a deeper sheet depth on the same path, or a route drawn over the page);
 *     otherwise it is undefined.
 *   - REPLACE: the entry left is gone from the history. When the page is kept (the same path,
 *     or a pick in the two panes) its offset moves to `nextKey`; otherwise nothing is kept.
 * The map is not mutated; it never grows past `PLACES_CAP` keys, the oldest by insertion go first.
 */
export function nextPlaces(
  places: Places,
  held: number | undefined,
  prevKey: string,
  nextKey: string,
  action: NavigationType,
  decision: ScrollDecision,
  overPage: boolean,
  pinned: boolean,
  liveScrollY: number,
): { places: Places; held: number | undefined } {
  const leaving = pinned ? held : liveScrollY
  const nextHeld = decision === 'keep' && overPage ? leaving : undefined
  const next = new Map(places)
  if (action === 'REPLACE') {
    const carried = decision === 'keep' ? (leaving ?? places.get(prevKey)) : undefined
    next.delete(prevKey)
    if (carried !== undefined) next.set(nextKey, carried)
  } else if (leaving !== undefined) {
    next.set(prevKey, leaving)
  }
  return { places: capped(next), held: nextHeld }
}

function capped<V>(memory: Map<string, V>): Map<string, V> {
  for (const key of memory.keys()) {
    if (memory.size <= PLACES_CAP) break
    memory.delete(key)
  }
  return memory
}

/** One location change, as `watchScroll` reads it in `router.subscribe`. */
export interface Change {
  prevKey: string
  nextKey: string
  action: NavigationType
  decision: ScrollDecision
  overPage: boolean
  /** The page is pinned: `html:has(.sheet)` or `html.html--formulario-fijo`. */
  pinned: boolean
  /** `window.scrollY` read synchronously at the moment of the change. */
  liveScrollY: number
}

let places: Places = new Map()
let decisions: ReadonlyMap<string, ScrollDecision> = new Map()
let held: number | undefined

/** The offset a history entry was left at, or undefined when none was kept for it. */
export function offsetFor(historyKey: string): number | undefined {
  return places.get(historyKey)
}

/** What was decided on arriving at a history entry, or undefined when it was never reached. */
export function decisionFor(historyKey: string): ScrollDecision | undefined {
  return decisions.get(historyKey)
}

/** Takes one location change into the memory: the offsets, `held` and the decision for `nextKey`. */
export function recordChange(change: Change): void {
  const step = nextPlaces(
    places,
    held,
    change.prevKey,
    change.nextKey,
    change.action,
    change.decision,
    change.overPage,
    change.pinned,
    change.liveScrollY,
  )
  places = step.places
  held = step.held
  decisions = capped(new Map(decisions).set(change.nextKey, change.decision))
}

/** Starts from nothing (a test's, or a fresh page). */
export function resetPlaces(): void {
  places = new Map()
  decisions = new Map()
  held = undefined
}
