/**
 * Applies the scroll decision (`scrollOnArrival.ts`) on every location change, once and at the
 * router, so no screen resets or restores its own scroll (navigation.md, "Scroll on a change of
 * screen", ADR-0063). Mounted by `Root` beside `RouterSync`. On each change, in a layout effect
 * (before the browser paints the new screen):
 *   1. a restore still in flight is cancelled, before this change's own decision applies;
 *   2. the decision is taken from the two pathnames, their screens, the navigation type and the
 *      viewport now;
 *   3. `top` scrolls to 0, `keep` does nothing, and `restore` follows the offset the entry was
 *      left at (`scrollPlaces.ts`) as its content loads (`scrollFollow.ts`), unless Record
 *      payment's own hand-off is pending: `useReturnToPlace` owns that return.
 * The first render does nothing, and the browser's own restore on a reload is left alone.
 */

import { useLayoutEffect, useRef } from 'react'
import { useLocation, useMatches, useNavigationType } from 'react-router'
import { peekPaymentReturn } from '../paymentReturn'
import { isScreenId, type ScreenId } from '../routes'
import { browserFollowDeps, startFollow } from './scrollFollow'
import { offsetFor } from './scrollPlaces'
import { scrollOnArrival, type Arrival } from './scrollOnArrival'
import { currentViewport } from './useViewport'

/** The screen of the deepest matched route that declares one (`handle.screen`). */
function useScreen(): ScreenId | undefined {
  let screen: ScreenId | undefined
  for (const { handle } of useMatches()) {
    if (typeof handle === 'object' && handle !== null && 'screen' in handle && isScreenId(handle.screen)) {
      screen = handle.screen
    }
  }
  return screen
}

export default function ScrollSync() {
  const { key, pathname } = useLocation()
  const navigationType = useNavigationType()
  const screen = useScreen()
  const previous = useRef<Arrival | null>(null)

  useLayoutEffect(() => {
    const left = previous.current
    const arrival: Arrival = { pathname, screen }
    previous.current = arrival
    if (left === null) return undefined
    const decision = scrollOnArrival(left, arrival, navigationType, currentViewport())
    if (decision === 'top') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      return undefined
    }
    if (decision === 'restore' && peekPaymentReturn() === null) return startFollow(offsetFor(key), browserFollowDeps())
    return undefined
  }, [key, pathname, screen, navigationType])

  return null
}
