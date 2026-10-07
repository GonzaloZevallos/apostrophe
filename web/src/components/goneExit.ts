/**
 * The gone notice a gone exit leaves behind on its parent (`useGoneExit`). When the exit goes
 * back through history there is no `location.state` to carry it (the parent's entry is already
 * there), so one slot remembers the notice: `markGone(path)` sets it, and it binds to the
 * `location.key` of the first location whose pathname is `path`. It shows only on that entry
 * (`useGoneNotice`), reading never consumes it, and the first navigation off that entry clears
 * it, so a second Back or a forward never shows it elsewhere. A parent that never mounts is
 * cleared on the next location change.
 *
 * The slot holds a pathname and a router key at most: no name, amount or business, and nothing
 * is stored. It follows the router through the handle `SheetRouterProvider` already has
 * (ADR-0027): `attachGoneNotice` subscribes to it.
 */

import { useSyncExternalStore } from 'react'
import { type Location, useLocation } from 'react-router'
import { readFeedback } from './feedback'

interface Slot {
  path: string
  /** The entry the exit started from: the router keeps announcing it until the move lands. */
  originKey: string
  boundKey: string | null
}

let slot: Slot | null = null
const listeners = new Set<() => void>()

function set(next: Slot | null): void {
  slot = next
  listeners.forEach((listener) => listener())
}

/** Leaves the notice for `path`, the location the exit goes back to, from the entry `originKey`. */
export function markGone(path: string, originKey: string): void {
  set({ path, originKey, boundKey: null })
}

function follow(location: Location): void {
  if (slot === null) return
  if (slot.boundKey === null) {
    if (location.key === slot.originKey) return
    set(location.pathname === slot.path ? { ...slot, boundKey: location.key } : null)
  } else if (location.key !== slot.boundKey) {
    set(null)
  }
}

/** What the notice needs of a data router: its location, and a way to hear it change. */
export interface LocationSource {
  state: { location: Location }
  subscribe: (listener: (state: { location: Location }) => void) => () => void
}

/** Follows `router`'s locations until the returned function is called, which clears the slot. */
export function attachGoneNotice(router: LocationSource): () => void {
  const unsubscribe = router.subscribe((state) => follow(state.location))
  return () => {
    unsubscribe()
    set(null)
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function boundKey(): string | null {
  return slot?.boundKey ?? null
}

/** Whether the gone notice shows on the entry on screen: bound to it, or carried in its state. */
export function useGoneNotice(): boolean {
  const location = useLocation()
  const bound = useSyncExternalStore(subscribe, boundKey)
  return location.key === bound || readFeedback(location.state)?.kind === 'notice'
}
