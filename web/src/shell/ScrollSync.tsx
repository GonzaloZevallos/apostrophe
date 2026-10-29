/**
 * Applies the scroll decision (`scrollOnArrival.ts`) on every location change, once and at the
 * router, so no screen resets or restores its own scroll (navigation.md, "Scroll on a change of
 * screen", ADR-0063). Mounted by `Root` beside `RouterSync`. On each change, in a layout effect
 * (before the browser paints the new screen):
 *   1. a restore still in flight is cancelled, before this change's own decision applies;
 *   2. the decision is taken from the two pathnames, their screens, the navigation type and the
 *      viewport of the render;
 *   3. `top` scrolls to 0, `keep` does nothing, and `restore` follows the offset the entry was
 *      left at (`scrollPlaces.ts`) as its content loads (`scrollFollow.ts`), unless Record
 *      payment's own hand-off is pending: `useReturnToPlace` owns that return.
 * The first render does nothing, and the browser's own restore on a reload is left alone.
 */

import { useLayoutEffect, useRef } from 'react'
import { matchRoutes, useLocation, useNavigationType } from 'react-router'
import { peekPaymentReturn } from '../paymentReturn'
import { isScreenId, SCREENS, type ScreenId } from '../routes'
import { browserFollowDeps, startFollow } from './scrollFollow'
import { offsetFor } from './scrollPlaces'
import { scrollOnArrival, type Arrival } from './scrollOnArrival'
import { useViewport } from './useViewport'

const SCREEN_ROUTES = SCREENS.map((entry) => ({ path: entry.path, id: entry.id }))

/** The registry screen at `pathname`, ranked as the router ranks (`/customers/new` before `/customers/:id`). */
function screenAt(pathname: string): ScreenId | undefined {
  const found = matchRoutes(SCREEN_ROUTES, pathname)?.at(-1)?.route.id
  return found !== undefined && isScreenId(found) ? found : undefined
}

export default function ScrollSync() {
  const { key, pathname } = useLocation()
  const navigationType = useNavigationType()
  const screen = screenAt(pathname)
  const previous = useRef<Arrival | null>(null)
  // The viewport as of this render, read by the effect without being one of its triggers: a
  // resize across 900 px is not a change of screen.
  const current = useViewport()
  const viewport = useRef(current)
  useLayoutEffect(() => {
    viewport.current = current
  }, [current])

  useLayoutEffect(() => {
    const left = previous.current
    const arrival: Arrival = { pathname, screen }
    previous.current = arrival
    if (left === null) return undefined
    const decision = scrollOnArrival(left, arrival, navigationType, viewport.current)
    if (decision === 'top') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      return undefined
    }
    if (decision === 'restore' && peekPaymentReturn() === null) return startFollow(offsetFor(key), browserFollowDeps())
    return undefined
  }, [key, pathname, screen, navigationType])

  return null
}
