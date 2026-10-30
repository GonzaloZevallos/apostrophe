/**
 * What `ScrollSync` is built on: the scroller seam (the window by default; a test drives frames,
 * timers and events by hand) and the numbers of the wait (ADR-0068). Kept out of the component's
 * file because fast refresh only works on a file that exports components alone.
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
  scrollTo(top: number): void
  onScroll(listener: () => void): () => void
  /** The seller's own input (touch, wheel, key): it ends a wait. */
  onInput(listener: () => void): () => void
  frame(callback: () => void): () => void
  after(ms: number, callback: () => void): () => void
}

const INPUT_EVENTS = ['touchstart', 'wheel', 'keydown'] as const

export const windowScroller: Scroller = {
  y: () => window.scrollY,
  maxY: () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
  height: () => document.documentElement.scrollHeight,
  scrollTo: (top) => window.scrollTo({ top, left: 0, behavior: 'instant' }),
  onScroll: (listener) => {
    window.addEventListener('scroll', listener, { passive: true })
    return () => window.removeEventListener('scroll', listener)
  },
  onInput: (listener) => {
    for (const type of INPUT_EVENTS) window.addEventListener(type, listener, { passive: true })
    return () => {
      for (const type of INPUT_EVENTS) window.removeEventListener(type, listener)
    }
  },
  frame: (callback) => {
    const id = window.requestAnimationFrame(callback)
    return () => window.cancelAnimationFrame(id)
  },
  after: (ms, callback) => {
    const id = window.setTimeout(callback, ms)
    return () => window.clearTimeout(id)
  },
}
