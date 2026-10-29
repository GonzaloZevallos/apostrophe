/**
 * Where each screen of the open tab was scrolled when the seller left it (navigation.md,
 * "Scroll on a change of screen", ADR-0064). The offsets are numbers in this module's memory,
 * keyed by the history entry's `location.key`: never in `localStorage`, `sessionStorage`,
 * history state or a URL, and they hold no personal data (§9). A reload empties them.
 *
 * `watchScroll` reads `window.scrollY` synchronously in `router.subscribe`, at the moment the
 * location changes and before React draws the new screen; a scroll listener would read it
 * after the commit, when the old screen is already gone. This module also owns
 * `history.scrollRestoration`: `'manual'` once the page has loaded plus one frame (so the
 * browser's own restore on a reload is never cancelled) and `'auto'` again on `pagehide`.
 */

import type { DataRouter } from 'react-router'

export type Places = ReadonlyMap<string, number>

type HistoryAction = 'POP' | 'PUSH' | 'REPLACE'

/**
 * The offsets after the location changed from `prevKey` to `nextKey` with `scrollY` as the
 * page's offset at that moment.
 *   - PUSH and POP: the screen being left keeps `scrollY` under its key.
 *   - REPLACE on the same path: the entry stays the same screen, so its offset moves to the
 *     new key (a filter written to the query must not lose the place).
 *   - REPLACE on a different path: the screen left is gone from the history; nothing is kept.
 */
export function nextPlaces(
  places: Places,
  prevKey: string,
  nextKey: string,
  action: HistoryAction,
  samePath: boolean,
  scrollY: number,
): Places {
  const next = new Map(places)
  if (action === 'REPLACE') {
    next.delete(prevKey)
    if (samePath) next.set(nextKey, scrollY)
    return next
  }
  next.set(prevKey, scrollY)
  return next
}

let places: Places = new Map()

/** The offset a history entry was left at, or 0 when it never was. */
export function offsetFor(historyKey: string): number {
  return places.get(historyKey) ?? 0
}

/** Starts from nothing (a test's, or a fresh page). */
export function resetPlaces(): void {
  places = new Map()
}

/** Records the offset of the screen being left, on every location change of `router`. */
export function watchScroll(router: Pick<DataRouter, 'state' | 'subscribe'>): () => void {
  let left = { key: router.state.location.key, pathname: router.state.location.pathname }
  return router.subscribe((state) => {
    const { key, pathname } = state.location
    if (key === left.key) return
    places = nextPlaces(places, left.key, key, state.historyAction, left.pathname === pathname, window.scrollY)
    left = { key, pathname }
  })
}

/** `history.scrollRestoration = 'manual'` after load plus one frame; `'auto'` on `pagehide`. */
export function holdScrollRestoration(): void {
  if (!('scrollRestoration' in window.history)) return
  const hold = (): void => {
    window.requestAnimationFrame(() => {
      window.history.scrollRestoration = 'manual'
    })
  }
  if (document.readyState === 'complete') hold()
  else window.addEventListener('load', hold, { once: true })
  window.addEventListener('pagehide', () => {
    window.history.scrollRestoration = 'auto'
  })
}
