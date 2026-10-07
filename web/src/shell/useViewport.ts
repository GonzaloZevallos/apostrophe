/**
 * Which of the two layouts is on screen: the bottom bar (`'phone'`) or the side rail
 * (`'computer'`). The only module that calls `matchMedia`; whatever else needs to know the
 * viewport (the parent a screen has on each, `routes.ts`) asks this hook.
 *
 * `COMPUTER_MIN_WIDTH` is the width at which `styles/app.css` hides `.bar-inferior` and shows
 * `.riel-lateral`: one number, the same `@media (min-width: 900px)`.
 */

import { useSyncExternalStore } from 'react'
import type { Viewport } from '../routes'

export const COMPUTER_MIN_WIDTH = 900

const COMPUTER_QUERY = `(min-width: ${COMPUTER_MIN_WIDTH}px)`

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined
  const query = window.matchMedia(COMPUTER_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function isComputer(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(COMPUTER_QUERY).matches
}

/** The viewport now, for code that decides when the user acts rather than when it renders. */
export function currentViewport(): Viewport {
  return isComputer() ? 'computer' : 'phone'
}

export function useViewport(): Viewport {
  return useSyncExternalStore(subscribe, isComputer) ? 'computer' : 'phone'
}
