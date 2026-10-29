/**
 * `startFollow`: brings the document to a saved offset on Back or Forward, and keeps trying
 * while the screen's content loads (navigation.md: "restored once the content has loaded, or
 * as far down as shorter content reaches", ADR-0064). Each animation frame scrolls to the
 * smaller of the offset and the farthest the page reaches, until the first of:
 *   - the page is at the offset;
 *   - `FOLLOW_CAP_MS` have passed;
 *   - the seller scrolls or touches the page themselves (wheel, touch, pointer, key);
 *   - `cancel()` is called, which the next location change does before its own decision.
 * The frame, the clock, the page and the seller's input are injected, so a fake can drive it.
 * This module and `scrollPlaces.ts`/`ScrollSync.tsx` are the only ones that move the document.
 */

export const FOLLOW_CAP_MS = 3000

export interface FollowDeps {
  /** Schedules `callback` for the next frame; returns what `cancelFrame` needs. */
  frame: (callback: () => void) => number
  cancelFrame: (handle: number) => void
  /** Milliseconds, monotonic. */
  now: () => number
  /** How far the page is scrolled now. */
  scrollY: () => number
  /** The farthest the page scrolls now: its height less the viewport's. */
  maxScroll: () => number
  scrollTo: (top: number) => void
  /** Calls `listener` on the seller's own input; returns the way to stop listening. */
  onSellerInput: (listener: () => void) => () => void
}

const SELLER_INPUTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const

/** The deps of the open page. */
export function browserFollowDeps(): FollowDeps {
  return {
    frame: (callback) => window.requestAnimationFrame(callback),
    cancelFrame: (handle) => window.cancelAnimationFrame(handle),
    now: () => window.performance.now(),
    scrollY: () => window.scrollY,
    maxScroll: () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
    scrollTo: (top) => window.scrollTo({ top, left: 0, behavior: 'instant' }),
    onSellerInput: (listener) => {
      for (const type of SELLER_INPUTS) window.addEventListener(type, listener, { passive: true, capture: true })
      return () => {
        for (const type of SELLER_INPUTS) window.removeEventListener(type, listener, { capture: true })
      }
    },
  }
}

/** Starts following `target`; returns the function that stops it (safe to call again). */
export function startFollow(target: number, deps: FollowDeps): () => void {
  const startedAt = deps.now()
  let handle: number | null = null
  let stopped = false
  let stopListening: (() => void) | null = null

  const stop = (): void => {
    if (stopped) return
    stopped = true
    if (handle !== null) deps.cancelFrame(handle)
    handle = null
    stopListening?.()
    stopListening = null
  }

  const step = (): void => {
    handle = null
    if (stopped) return
    const reach = Math.min(target, deps.maxScroll())
    if (Math.round(deps.scrollY()) !== Math.round(reach)) deps.scrollTo(reach)
    if (reach >= target || deps.now() - startedAt >= FOLLOW_CAP_MS) {
      stop()
      return
    }
    handle = deps.frame(step)
  }

  stopListening = deps.onSellerInput(stop)
  step()
  return stop
}
