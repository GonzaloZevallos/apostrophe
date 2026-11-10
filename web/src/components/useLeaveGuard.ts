/**
 * The one leave guard (plan, invariants: no module but this one calls `useBlocker`).
 * It blocks leaving a form or sheet only while `dirty`, and never after `disarm()`.
 *
 * Both flags are read from refs at call time: `shouldBlock` runs inside the router's
 * navigation, before React has re-rendered, so a state value would be stale. `disarm()`
 * sets its ref synchronously, so `disarm(); navigate(...)` in one tick is not blocked even
 * though `dirty` is still true. Call it only right before a navigation that follows a
 * successful save or a logout, never from "Cerrar".
 *
 * A navigation that keeps the pathname and search and changes only the `sheet` depth is
 * never blocked: it opens or closes a sheet, not the form (ADR-0027).
 *
 * The one exception is a form that is itself drawn as a sheet entry (an in-page sheet on the
 * phone, ADR-0078): it passes `{ sheetFloor }`, the depth of its own entry, and then a
 * sheet-only navigation whose next depth falls below that floor is blocked too, because it
 * closes the form. Without the option, behaviour is exactly as above. Whoever passes it must
 * leave through a single exit that calls `disarm()` before it pops.
 */

import { useCallback, useLayoutEffect, useRef } from 'react'
import { type Blocker, type BlockerFunction, useBlocker } from 'react-router'
import { sheetDepth } from './useSheetStack'

export interface LeaveGuard {
  blocker: Blocker
  disarm: () => void
}

export interface LeaveGuardOptions {
  /** The sheet depth of the form's own entry: a sheet-only navigation below it leaves the form. */
  sheetFloor?: number
}

export function useLeaveGuard(dirty: boolean, { sheetFloor }: LeaveGuardOptions = {}): LeaveGuard {
  const dirtyRef = useRef(dirty)
  // A layout effect: it runs in the commit that shows the typed value, so no Back can arrive
  // between the screen showing it and the guard counting it.
  useLayoutEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])
  const disarmedRef = useRef(false)
  const disarm = useCallback(() => {
    disarmedRef.current = true
  }, [])
  const shouldBlock = useCallback<BlockerFunction>(({ currentLocation, nextLocation }) => {
    const onlySheetChanges =
      currentLocation.pathname === nextLocation.pathname &&
      currentLocation.search === nextLocation.search &&
      sheetDepth(currentLocation.state) !== sheetDepth(nextLocation.state)
    const leavesTheSheet =
      onlySheetChanges && sheetFloor !== undefined && sheetDepth(nextLocation.state) < sheetFloor
    return (!onlySheetChanges || leavesTheSheet) && !disarmedRef.current && dirtyRef.current
  }, [sheetFloor])
  const blocker = useBlocker(shouldBlock)
  return { blocker, disarm }
}
