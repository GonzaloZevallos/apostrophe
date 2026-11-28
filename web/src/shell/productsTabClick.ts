/**
 * The Products tab tap. A plain primary click on the tab navigates with a fresh Products tab
 * nonce in the history state (`productsTabState`), which tells `ProductsSearchProvider` the seller
 * tapped the tab on purpose. Any other click (a modifier, the middle button, a `target` other than
 * `_self`, one already prevented) falls through to the `<a>`, so the browser opens it as it would
 * any link. The nonce is drawn inside the click, never while rendering.
 */

import type { MouseEvent } from 'react'
import { createPath, useLocation, useNavigate, useResolvedPath } from 'react-router'
import { productsTabState } from '../screens/varieties/productsSearch'

/** The part of a click on an anchor that decides whether it is a plain primary click. */
export interface ClickLike {
  button: number
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  defaultPrevented: boolean
  currentTarget: { target: string }
}

/** The left button alone, not already handled, on a link that stays in this window. */
export function isPlainPrimaryClick(event: ClickLike): boolean {
  const { target } = event.currentTarget
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.defaultPrevented &&
    (target === '' || target === '_self')
  )
}

/**
 * The `onClick` of the Products tab link to `to`. Tapping the entry the seller is already on is a
 * REPLACE, the rule `Link` itself follows, so the tab never stacks identical entries.
 */
export function useProductsTabClick(to: string): (event: MouseEvent<HTMLAnchorElement>) => void {
  const navigate = useNavigate()
  const location = useLocation()
  const resolved = useResolvedPath(to)
  return (event) => {
    if (!isPlainPrimaryClick(event)) return
    event.preventDefault()
    void navigate(to, { state: productsTabState(), replace: createPath(resolved) === createPath(location) })
  }
}
