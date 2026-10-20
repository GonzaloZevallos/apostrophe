// When a design capture has finished drawing (ADR-0042). Pure: the browser, the fake clock
// and the frame sampling live in `comparisons.mjs`, which hands `settleWith` a port. Nothing
// here reads a clock or waits; the bound counts frames, it does not measure time.

// The smallest advance of the fake clock that fires every debounce or wait whose result a
// capture must show: KEYBOARD_WAIT_MS (300) in web/src/shell/keepFocusVisible.ts, and the
// 150 ms debounces in web/src/screens/Clientes.tsx and Cobro.tsx.
export const SETTLE_ADVANCE_MS = 350

// Consecutive calm frames with an equal layout hash that count as settled, and the most
// frames sampled before giving up. The bound caps how long the capture waits; it asserts
// nothing about elapsed time.
export const SETTLE_FRAMES = 3
export const SETTLE_BOUND = 120

// Real `MessageChannel` hops a frame waits, after its first one, before it reads the mutation
// flag: a commit that lands later than the first hop still counts against that frame. Measured
// under 10x CPU throttling (GH-273 diagnosis): the largest lag seen was 0 extra hops; 2 is a
// margin on a count that is cheap, not a measured need.
export const SETTLE_QUIET_HOPS = 2

// The one reason a side that did not come to rest returns, whichever way the bound was reached
// (churn, a request in flight, a mutation, an animation finished); and the one for a frame
// that rejected. They name what failed and carry no page text, amounts or names.
export const SETTLE_REASON_UNSETTLED = 'la pantalla no quedó quieta'
export const SETTLE_REASON_REJECTED = 'la pantalla no respondió mientras se esperaba que terminara'

// A frame is calm when nothing in it is still changing: no request in flight or completed since
// the last frame, fonts loaded, no DOM mutation since the last frame and no animation finished
// by this one.
const isCalm = (frame) => frame.idle && frame.fontsLoaded && !frame.mutated && !frame.unfinishedAnimation

// `null` once `frames` consecutive frames are each calm and all carry the same hash; otherwise
// a fixed reason.
export async function settleWith(port, { advanceMs, frames, bound }) {
  try {
    if (advanceMs > 0) await port.advance(advanceMs)
    let run = 0
    let last = null
    for (let sampled = 0; sampled < bound; sampled += 1) {
      const frame = await port.frame()
      if (!isCalm(frame)) {
        run = 0
        last = null
        continue
      }
      run = frame.hash === last ? run + 1 : 1
      last = frame.hash
      if (run >= frames) return null
    }
    return SETTLE_REASON_UNSETTLED
  } catch {
    return SETTLE_REASON_REJECTED
  }
}

// The screenshot is kept only if one more frame, sampled after it with no clock advance, is
// calm and has the hash of the last settled frame.
export const shotKept = (frame, settledHash) => isCalm(frame) && frame.hash === settledHash

// One record per element that has a box: tag, offset geometry, own text and a closed list of
// control state read as DOM properties and attributes, never a computed style, colour or class
// list. Self-contained like `signatureOf`: `comparisons.mjs` passes this function to the page by
// `toString()`. One expression per field.
export function frameRecords(doc) {
  const drawn = [doc.body, ...doc.body.querySelectorAll('*')].filter((e) => 'offsetWidth' in e && typeof e.offsetWidth === 'number')
  return drawn.map((e) => ({
    tag: e.tagName,
    left: e.offsetLeft,
    top: e.offsetTop,
    width: e.offsetWidth,
    height: e.offsetHeight,
    text: [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(''),
    disabled: e.disabled === true,
    checked: e.checked === true,
    ariaChecked: e.getAttribute('aria-checked'),
    ariaPressed: e.getAttribute('aria-pressed'),
    ariaSelected: e.getAttribute('aria-selected'),
    ariaDisabled: e.getAttribute('aria-disabled'),
    ariaBusy: e.getAttribute('aria-busy'),
  }))
}

// Every animation the page has, as what `unfinished` reads. An animation with no effect counts
// as one that never ends. Self-contained, for the same reason as `frameRecords`.
export function animationRecords(doc) {
  return doc.getAnimations().map((a) => ({
    playState: a.playState,
    pending: a.pending,
    finite: Number.isFinite(a.effect?.getComputedTiming().iterations),
  }))
}

// The one decision of which animations are unfinished: one flag per record, true for a finite
// animation that is running or has a pending start. Paused, finished and idle ones are at rest,
// and an infinite one is never flagged. Self-contained: the capture sends it to the page.
export function unfinished(records) {
  return records.map((r) => r.finite && (r.pending || r.playState === 'running'))
}

// A 32-bit FNV-1a hex string over the layout: one record per element and the page's own
// figures. Geometry is `offset*`, which ignores `transform`, so a running transition cannot
// enter by it; control state enters as the closed list of fields below, so a flip that moves
// no box still changes the hash. Self-contained on purpose (no module scope, no imports):
// `comparisons.mjs` passes this very function to the page, and only the hash crosses back.
export function signatureOf(records, page) {
  const text = JSON.stringify([
    records.map((r) => [
      r.tag,
      r.left,
      r.top,
      r.width,
      r.height,
      r.text,
      r.disabled,
      r.checked,
      r.ariaChecked,
      r.ariaPressed,
      r.ariaSelected,
      r.ariaDisabled,
      r.ariaBusy,
    ]),
    [page.scrollWidth, page.scrollHeight, page.imagesComplete, page.fontsLoaded],
  ])
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

// A side that did not settle (or failed any step) has no capture under any name.
export function sideOutcome(reason, png) {
  return reason === null ? { png, failure: null } : { png: null, failure: reason }
}
