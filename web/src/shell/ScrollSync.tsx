/**
 * The one owner of the page's scroll on a change of screen (navigation.md, "Scroll on a change
 * of screen", criteria 21-23; ADR-0068). Mounted once in `Root`, above the public and the gated
 * trees. Nothing else in `web/src` scrolls the page: `architecture/navigationScroll.test.ts`
 * keeps it so.
 *
 *   - Offsets live in memory only, under the history entry's own key (ADR-0026): never in
 *     browser storage, in history state or through react-router's `ScrollRestoration`. At most
 *     100 are kept.
 *   - A passive `scroll` listener writes the offset under the current entry. While a restore or
 *     keep is pending for that entry it writes nothing: the clamp events of a page that is
 *     still short would overwrite the offset it is waiting to come back to.
 *   - On an entry change the target's offset is read first and the current entry switched after
 *     it; `decideScroll` (`scrollPlan.ts`) then says `top`, `restore`, `keep` or `none`.
 *   - A restore or keep waits until no Loading marker is on the page and the document height
 *     has held for two frames, then sets `min(offset, maximum scroll)` once. A touch, a wheel,
 *     a key or a new navigation ends the wait. The 5 s ceiling is only a net.
 * The scroller (the window by default) is injected so a test drives frames by hand.
 */

import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router'
import { LOADING_MARKER } from '../components/Loading'
import { decideScroll, type PlaceInHistory } from './scrollPlan'
import { CEILING_MS, MAX_REMEMBERED, SETTLE_FRAMES, type Scroller } from './scroller'
import { useViewport } from './useViewport'

/** The seller's own inputs: any of them ends a pending restore. */
const INPUT_EVENTS = ['touchstart', 'wheel', 'keydown'] as const

/** The window as a scroller: the only place the page is actually scrolled. */
const windowScroller: Scroller = {
  y: () => window.scrollY,
  maxY: () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
  height: () => document.documentElement.scrollHeight,
  setY: (top) => window.scrollTo({ top, left: 0, behavior: 'instant' }),
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

function remember(offsets: Map<string, number>, entry: string, offset: number): void {
  offsets.delete(entry)
  offsets.set(entry, offset)
  for (const oldest of offsets.keys()) {
    if (offsets.size <= MAX_REMEMBERED) break
    offsets.delete(oldest)
  }
}

type WaitEnd = 'applied' | 'input' | 'ceiling'

/** Waits for the page to settle, then sets `min(target, maximum)` once. The returned function
 * stops the wait without calling `onEnd`. */
function waitThenScroll(scroller: Scroller, target: number, onEnd: (how: WaitEnd) => void): () => void {
  let stable = 0
  let lastHeight = scroller.height()
  let stopped = false
  let cancelFrame: (() => void) | null = null
  const observer = new MutationObserver(() => {
    stable = 0
  })
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-busy'] })
  const loading = () => document.querySelector(LOADING_MARKER) !== null

  const offInput = scroller.onInput(() => end('input'))
  const cancelCeiling = scroller.after(CEILING_MS, () => end('ceiling'))

  function stop(): void {
    if (stopped) return
    stopped = true
    observer.disconnect()
    cancelFrame?.()
    cancelCeiling()
    offInput()
  }
  function end(how: WaitEnd): void {
    if (stopped) return
    stop()
    if (how === 'applied') scroller.setY(Math.min(target, scroller.maxY()))
    onEnd(how)
  }
  function step(): void {
    cancelFrame = null
    const height = scroller.height()
    if (loading() || height !== lastHeight) stable = 0
    else stable += 1
    lastHeight = height
    if (stable >= SETTLE_FRAMES) end('applied')
    else cancelFrame = scroller.frame(step)
  }
  cancelFrame = scroller.frame(step)
  return stop
}

interface Sync {
  /** The history entry the page is on. */
  entry: string
  place: PlaceInHistory
  offsets: Map<string, number>
  /** A restore or keep is waiting for this entry: its offset is not written meanwhile. */
  pending: boolean
  cancelWait: (() => void) | null
}

export default function ScrollSync({ scroller = windowScroller }: { scroller?: Scroller }) {
  const location = useLocation()
  const action = useNavigationType()
  const viewport = useViewport()
  const sync = useRef<Sync | null>(null)
  // The viewport is read when the entry changes; a resize alone must not re-run that effect, or
  // it would cancel a wait that is pending.
  const viewportNow = useRef(viewport)
  useLayoutEffect(() => {
    viewportNow.current = viewport
  }, [viewport])

  useEffect(() => {
    history.scrollRestoration = 'manual'
    return scroller.onScroll(() => {
      const current = sync.current
      if (current === null || current.pending) return
      remember(current.offsets, current.entry, scroller.y())
    })
  }, [scroller])

  useLayoutEffect(() => {
    const place: PlaceInHistory = { pathname: location.pathname, state: location.state }
    const entry = location.key
    const current = sync.current
    const stopWaiting = () => {
      const now = sync.current
      if (now === null) return
      now.cancelWait?.()
      now.cancelWait = null
      now.pending = false
    }
    if (current === null) {
      sync.current = { entry, place, offsets: new Map(), pending: false, cancelWait: null }
      return stopWaiting
    }
    if (current.entry === entry) return stopWaiting

    const decision = decideScroll(current.place, place, action, viewportNow.current)
    const previous = current.offsets.get(current.entry)
    // The target's offset is read before the entry switches.
    const stored = current.offsets.get(entry)
    current.entry = entry
    current.place = place

    if (decision === 'none') {
      if (previous !== undefined) remember(current.offsets, entry, previous)
      return stopWaiting
    }
    if (decision === 'top') {
      scroller.setY(0)
      remember(current.offsets, entry, 0)
      return stopWaiting
    }
    const target = decision === 'restore' ? (stored ?? 0) : (previous ?? scroller.y())
    remember(current.offsets, entry, target)
    if (target <= 0) {
      scroller.setY(0)
      return stopWaiting
    }
    current.pending = true
    current.cancelWait = waitThenScroll(scroller, target, (how) => {
      current.cancelWait = null
      current.pending = false
      if (how === 'input') remember(current.offsets, entry, scroller.y())
    })
    return stopWaiting
  }, [location, action, scroller])

  return null
}
