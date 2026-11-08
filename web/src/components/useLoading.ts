/**
 * The loading count of a content area (`ContentArea.tsx`) and the hook that raises it.
 *
 * The count lives outside React state: when it crosses 0 and 1 the store sets or removes
 * `aria-busy` on the element it is attached to, so the attribute lands in the commit that mounts
 * the loading shape, before paint, without a render of its own. Nothing writes `aria-busy` in JSX.
 */

import { createContext, useContext, useLayoutEffect } from 'react'

export interface LoadingStore {
  /** Applies the current count to the element, and keeps applying it until the returned cleanup. */
  attach: (element: HTMLElement) => () => void
  increment: () => void
  decrement: () => void
}

export function createLoadingStore(): LoadingStore {
  let count = 0
  let element: HTMLElement | null = null
  function apply(): void {
    if (element === null) return
    if (count > 0) element.setAttribute('aria-busy', 'true')
    else element.removeAttribute('aria-busy')
  }
  return {
    attach(node) {
      element = node
      apply()
      return () => {
        element = null
      }
    },
    increment() {
      count += 1
      if (count === 1) apply()
    },
    decrement() {
      count -= 1
      if (count === 0) apply()
    },
  }
}

/** The nearest content area that owns a count; `null` where there is none. */
export const LoadingOwner = createContext<LoadingStore | null>(null)

/**
 * Marks the nearest content area busy while `active`. It counts in a layout effect, so the
 * attribute lands before paint, and it gives the count back on cleanup, so overlapping loads keep
 * the area busy until the last one ends and StrictMode's double run stays balanced. With no
 * content area above it does nothing.
 */
export function useLoading(active: boolean): void {
  const owner = useContext(LoadingOwner)
  useLayoutEffect(() => {
    if (!active || owner === null) return
    owner.increment()
    return () => owner.decrement()
  }, [active, owner])
}
