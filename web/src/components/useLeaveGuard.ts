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
 */

import { useCallback, useEffect, useRef } from 'react'
import { type Blocker, type BlockerFunction, useBlocker } from 'react-router'
import { sheetDepth } from './useSheetStack'

export interface LeaveGuard {
  blocker: Blocker
  disarm: () => void
}

export function useLeaveGuard(dirty: boolean): LeaveGuard {
  const dirtyRef = useRef(dirty)
  useEffect(() => {
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
    return !onlySheetChanges && !disarmedRef.current && dirtyRef.current
  }, [])
  const blocker = useBlocker(shouldBlock)
  return { blocker, disarm }
}
