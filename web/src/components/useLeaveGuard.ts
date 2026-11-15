/**
 * The one leave guard (plan, invariants: no module but this one calls `useBlocker`).
 * A navigation is judged in this order, and nothing blocks once `disarm()` has been called:
 *
 * 1. A navigation that changes more than the sheet (another path or search) blocks while `dirty`.
 * 2. A navigation that keeps the pathname and search and changes only the `sheet` depth opens or
 *    closes a sheet, not the form (ADR-0027), so it is not blocked. That comparison is the
 *    exported `onlySheetChanges`, the one definition; a host that needs it imports it.
 * 3. The one exception is a form that is itself drawn as a sheet entry (an in-page sheet on the
 *    phone, ADR-0078): it passes `{ sheetFloor }`, the depth of its own entry, and then a
 *    sheet-only navigation whose next depth falls below that floor closes the form, so it blocks
 *    while `sheetDirty`. `sheetDirty` defaults to `dirty`; a host passes it when what a sheet
 *    close would lose differs from what leaving the page would lose. Whoever passes a floor
 *    must leave through a single exit that calls `disarm()` before it pops.
 *
 * `dirty`, `sheetFloor` and `sheetDirty` are read from refs at call time: `shouldBlock` runs
 * inside the router's navigation, before React has re-rendered, so a state value would be stale,
 * and its callback is built once so the router never holds an outdated one. The refs are written
 * by a layout effect, so they are current in the commit that shows the typed value or sets the
 * floor, before any Back or pop that the same commit triggers. The default `sheetDirty ?? dirty`
 * is resolved there and nowhere else.
 *
 * `disarm()` sets its ref synchronously, so `disarm(); navigate(...)` in one tick is not blocked
 * even though `dirty` is still true. Call it only right before a navigation that follows a
 * successful save or a logout, never from "Cerrar".
 */

import { useCallback, useLayoutEffect, useRef } from 'react'
import { type Blocker, type BlockerFunction, type Location, useBlocker } from 'react-router'
import { sheetDepth } from './useSheetStack'

export interface LeaveGuard {
  blocker: Blocker
  disarm: () => void
}

export interface LeaveGuardOptions {
  /** The sheet depth of the form's own entry: a sheet-only navigation below it leaves the form. */
  sheetFloor?: number
  /** Whether closing the form's own sheet would lose something; defaults to `dirty`. */
  sheetDirty?: boolean
}

/** The part of a router `Location` the sheet-only comparison reads. */
export type SheetLocation = Pick<Location, 'pathname' | 'search' | 'state'>

/** True when the navigation keeps the pathname and search and only changes the sheet depth. */
export function onlySheetChanges(currentLocation: SheetLocation, nextLocation: SheetLocation): boolean {
  return (
    currentLocation.pathname === nextLocation.pathname &&
    currentLocation.search === nextLocation.search &&
    sheetDepth(currentLocation.state) !== sheetDepth(nextLocation.state)
  )
}

export function useLeaveGuard(dirty: boolean, { sheetFloor, sheetDirty }: LeaveGuardOptions = {}): LeaveGuard {
  const dirtyRef = useRef(dirty)
  const sheetFloorRef = useRef(sheetFloor)
  const sheetDirtyRef = useRef(sheetDirty ?? dirty)
  useLayoutEffect(() => {
    dirtyRef.current = dirty
    sheetFloorRef.current = sheetFloor
    sheetDirtyRef.current = sheetDirty ?? dirty
  }, [dirty, sheetFloor, sheetDirty])
  const disarmedRef = useRef(false)
  const disarm = useCallback(() => {
    disarmedRef.current = true
  }, [])
  const shouldBlock = useCallback<BlockerFunction>(({ currentLocation, nextLocation }) => {
    if (disarmedRef.current) return false
    if (!onlySheetChanges(currentLocation, nextLocation)) return dirtyRef.current
    const floor = sheetFloorRef.current
    if (floor !== undefined && sheetDepth(nextLocation.state) < floor) return sheetDirtyRef.current
    return false
  }, [])
  const blocker = useBlocker(shouldBlock)
  return { blocker, disarm }
}
