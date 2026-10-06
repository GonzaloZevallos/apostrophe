/**
 * Whether the viewport is a computer's (the design's 900 px breakpoint, the one the CSS
 * switches the rail and the bar on). Read through `matchMedia` and kept current, so a
 * screen that draws two panes there and one pane on a phone follows a resize.
 */

import { useSyncExternalStore } from 'react'

const COMPUTER_QUERY = '(min-width: 900px)'

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined
  const query = window.matchMedia(COMPUTER_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function isComputer(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(COMPUTER_QUERY).matches
}

export function useIsComputer(): boolean {
  return useSyncExternalStore(subscribe, isComputer)
}
