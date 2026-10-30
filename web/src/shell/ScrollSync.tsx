/**
 * Applies the scroll decision on every location change (navigation.md, "Scroll on arrival and
 * return", ADR-0065). The decision itself is taken once per location key by `watchScroll`
 * (`scrollPlaces.ts`), before the new screen is drawn; this component only applies it, in a
 * layout effect, before the browser paints the new screen. Mounted by `Root` beside `RouterSync`.
 *   - A follow still in flight is cancelled first, before this change's own decision.
 *   - `top` scrolls the document to 0, `keep` does nothing, and `restore` follows the offset the
 *     entry was left at as its content loads (`scrollFollow.ts`); an entry with no saved offset
 *     goes to the top.
 *   - Leaving Record payment while its hand-off is pending applies nothing: `useReturnToPlace`
 *     owns that return.
 * The first render does nothing, and the browser's own restore on a reload is left alone.
 */

import { useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { peekPaymentReturn } from '../paymentReturn'
import { browserFollowDeps, startFollow } from './scrollFollow'
import { decisionFor, offsetFor, screenAt } from './scrollPlaces'

export default function ScrollSync() {
  const { key, pathname } = useLocation()
  const left = useRef<string | null>(null)
  const follow = useRef<(() => void) | null>(null)

  useLayoutEffect(() => {
    follow.current?.()
    follow.current = null
    const leftPathname = left.current
    left.current = pathname
    if (leftPathname === null) return
    if (screenAt(leftPathname) === 'customer-payment' && peekPaymentReturn() !== null) return
    const decision = decisionFor(key)
    if (decision === 'top') window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    else if (decision === 'restore') follow.current = startFollow(offsetFor(key) ?? 0, browserFollowDeps())
  }, [key, pathname])

  useLayoutEffect(
    () => () => {
      follow.current?.()
      follow.current = null
    },
    [],
  )

  return null
}
