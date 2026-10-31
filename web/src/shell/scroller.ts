/**
 * What `ScrollSync` is built on: the scroller seam (`ScrollSync` fits the window to it; a test
 * drives frames, timers and events by hand) and the numbers of the wait (ADR-0069). Kept out of
 * the component's file because fast refresh only works on a file that exports components alone.
 * Nothing here touches the page's scroll: that is `ScrollSync.tsx` alone.
 */

/** How many animation frames the document height has to hold before the page is settled. */
export const SETTLE_FRAMES = 2
/** The wait's ceiling: a net that stops the observer, never the normal way out. */
export const CEILING_MS = 5000
/** How many offsets are remembered; the oldest go first. */
export const MAX_REMEMBERED = 100

export interface Scroller {
  y(): number
  /** The furthest the page can scroll now. */
  maxY(): number
  /** The document's height: it is what "has the content arrived" is measured on. */
  height(): number
  /** Puts the page at `top`. Only `ScrollSync` implements it on the real window. */
  setY(top: number): void
  onScroll(listener: () => void): () => void
  /** The seller's own input (touch, wheel, key): it ends a wait. */
  onInput(listener: () => void): () => void
  frame(callback: () => void): () => void
  after(ms: number, callback: () => void): () => void
}
