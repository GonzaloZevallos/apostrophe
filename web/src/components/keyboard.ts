/**
 * Whether the on-screen keyboard is open (ADR-0028, amended). The one place that decides it:
 * `isKeyboardOpen` is the pure rule, and the store below feeds it from the window, the visual
 * viewport and focus. `useVisualViewport` is the only reader of the store, so nothing else
 * reads `visualViewport` to decide it.
 *
 * - iOS keeps the layout viewport and shrinks only the visual one, so the gap
 *   `innerHeight - visualViewport.height` is the keyboard. It needs no focus.
 * - Android Chrome (`resizes-content`) shrinks `innerHeight` itself, so the gap is zero. The
 *   keyboard is `innerHeight` more than 120 px below a baseline, while a text-entry control has
 *   focus (or just had, `FOCUS_SETTLE_MS`). The baseline is the largest `innerHeight` seen since
 *   the last orientation or width change, never a value taken at mount.
 * - Pinch-zoom (`scale !== 1`) describes the zoom, not a keyboard: nothing is open and nothing
 *   is pinned.
 * - Without `visualViewport`, focus on a text-entry control counts as open.
 *
 * The store starts on its first subscriber, rebinds when `window.visualViewport` is another
 * object, and clears everything when its last subscriber leaves. It reads only geometry and
 * focus; nothing is stored or sent.
 */

export const KEYBOARD_GAP_PX = 120

/** After a text-entry control loses focus, a drop in `innerHeight` is still the keyboard's. */
export const FOCUS_SETTLE_MS = 500

export interface ViewportReading {
  height: number
  offsetTop: number
  scale: number
}

export interface KeyboardSnapshot {
  innerHeight: number
  innerWidth: number
  /** The visual viewport's numbers, or none where `window.visualViewport` is missing. */
  viewport: ViewportReading | null
  /** The largest `innerHeight` seen since the last orientation or width change. */
  baseline: number
  /** A text-entry control has focus. */
  textFocus: boolean
  /** No text-entry control has focus, but one had it less than `FOCUS_SETTLE_MS` ago. */
  settling: boolean
}

export function isKeyboardOpen(snapshot: KeyboardSnapshot): boolean {
  const { viewport } = snapshot
  if (viewport === null) return snapshot.textFocus
  if (viewport.scale !== 1) return false
  if (snapshot.innerHeight - viewport.height > KEYBOARD_GAP_PX) return true
  const dropped = snapshot.baseline - snapshot.innerHeight > KEYBOARD_GAP_PX
  return dropped && (snapshot.textFocus || snapshot.settling)
}

const TEXT_TYPES = new Set(['text', 'search', 'email', 'tel', 'url', 'password', 'number', ''])

/** A control the on-screen keyboard types into: a textarea, or an input of a text-like (or no) type. */
export function isTextEntry(element: Element | null): boolean {
  if (element instanceof HTMLTextAreaElement) return true
  if (element instanceof HTMLInputElement) return TEXT_TYPES.has(element.type)
  return false
}

export interface KeyboardState {
  open: boolean
  /** Where the visual viewport is, or none while pinch-zoomed or without `visualViewport`. */
  viewport: { top: number; height: number } | null
}

const IDLE: KeyboardState = { open: false, viewport: null }

type Listener = (state: KeyboardState) => void

const listeners = new Set<Listener>()
let running = false
let state: KeyboardState = IDLE
let boundViewport: VisualViewport | null = null
let baseline = 0
let lastWidth = 0
let textFocus = false
let lastTextFocusOut = Number.NEGATIVE_INFINITY
let settleTimer: ReturnType<typeof setTimeout> | null = null

function settling(): boolean {
  return !textFocus && Date.now() - lastTextFocusOut < FOCUS_SETTLE_MS
}

function reading(): ViewportReading | null {
  const viewport = window.visualViewport
  if (!viewport) return null
  return { height: viewport.height, offsetTop: viewport.offsetTop, scale: viewport.scale }
}

function sameState(a: KeyboardState, b: KeyboardState): boolean {
  if (a.open !== b.open) return false
  if (a.viewport === null || b.viewport === null) return a.viewport === b.viewport
  return a.viewport.top === b.viewport.top && a.viewport.height === b.viewport.height
}

function moveBaseline(): void {
  if (window.innerWidth !== lastWidth) {
    lastWidth = window.innerWidth
    baseline = window.innerHeight
  } else if (window.innerHeight > baseline) {
    baseline = window.innerHeight
  } else if (!textFocus && !settling()) {
    baseline = window.innerHeight
  }
}

function recompute(): void {
  moveBaseline()
  const viewport = reading()
  const open = isKeyboardOpen({
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    viewport,
    baseline,
    textFocus,
    settling: settling(),
  })
  const next: KeyboardState = {
    open,
    viewport: viewport !== null && viewport.scale === 1 ? { top: viewport.offsetTop, height: viewport.height } : null,
  }
  if (sameState(state, next)) return
  state = next
  for (const listener of [...listeners]) listener(state)
}

function onFocusIn(event: FocusEvent): void {
  textFocus = isTextEntry(event.target as Element | null)
  recompute()
}

function onFocusOut(): void {
  if (textFocus) {
    textFocus = false
    lastTextFocusOut = Date.now()
    if (settleTimer !== null) clearTimeout(settleTimer)
    settleTimer = setTimeout(() => {
      settleTimer = null
      recompute()
    }, FOCUS_SETTLE_MS)
  }
  recompute()
}

function onOrientationChange(): void {
  baseline = window.innerHeight
  lastWidth = window.innerWidth
  recompute()
}

function bindViewport(viewport: VisualViewport | null): void {
  boundViewport?.removeEventListener('resize', recompute)
  boundViewport?.removeEventListener('scroll', recompute)
  boundViewport = viewport
  viewport?.addEventListener('resize', recompute)
  viewport?.addEventListener('scroll', recompute)
}

function start(): void {
  running = true
  baseline = window.innerHeight
  lastWidth = window.innerWidth
  textFocus = isTextEntry(document.activeElement)
  lastTextFocusOut = Number.NEGATIVE_INFINITY
  window.addEventListener('resize', recompute)
  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('focusout', onFocusOut)
  screen.orientation?.addEventListener('change', onOrientationChange)
  bindViewport(window.visualViewport)
  recompute()
}

function stop(): void {
  running = false
  window.removeEventListener('resize', recompute)
  document.removeEventListener('focusin', onFocusIn)
  document.removeEventListener('focusout', onFocusOut)
  screen.orientation?.removeEventListener('change', onOrientationChange)
  bindViewport(null)
  if (settleTimer !== null) clearTimeout(settleTimer)
  settleTimer = null
  baseline = 0
  lastWidth = 0
  textFocus = false
  lastTextFocusOut = Number.NEGATIVE_INFINITY
  state = IDLE
}

/**
 * Follows the keyboard: `listener` is called now and on every change. The first subscriber
 * starts the store; a later one rebinds it when `window.visualViewport` is another object.
 * The returned function unsubscribes, and the last one out stops the store and clears it.
 */
export function subscribeKeyboard(listener: Listener): () => void {
  listeners.add(listener)
  if (!running) start()
  else if (window.visualViewport !== boundViewport) {
    bindViewport(window.visualViewport)
    baseline = window.innerHeight
    lastWidth = window.innerWidth
    recompute()
  }
  listener(state)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) stop()
  }
}
