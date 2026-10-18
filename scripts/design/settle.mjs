// When a design capture has finished drawing (ADR-0042). Pure: the browser, the fake clock
// and the frame sampling live in `comparisons.mjs`, which hands `settleWith` a port. Nothing
// here reads a clock or waits; the bound counts frames, it does not measure time.

// The smallest advance of the fake clock that fires every debounce or wait whose result a
// capture must show: KEYBOARD_WAIT_MS (300) in web/src/shell/keepFocusVisible.ts, and the
// 150 ms debounces in web/src/screens/Clientes.tsx and Cobro.tsx.
export const SETTLE_ADVANCE_MS = 350

// Consecutive calm frames with an equal layout hash that count as settled, and the most
// frames sampled before giving up.
export const SETTLE_FRAMES = 3
export const SETTLE_BOUND = 120

// Fixed reasons: they name what failed and carry no page text, amounts or names.
export const SETTLE_REASON_UNSETTLED = 'la pantalla no terminó de dibujarse'
export const SETTLE_REASON_REJECTED = 'la pantalla no respondió mientras se esperaba que terminara'

// `null` once `frames` consecutive frames are each idle, with no pending finite animation and
// fonts loaded, and all carry the same hash; otherwise a fixed reason.
export async function settleWith(port, { advanceMs, frames, bound }) {
  try {
    if (advanceMs > 0) await port.advance(advanceMs)
    let run = 0
    let last = null
    for (let sampled = 0; sampled < bound; sampled += 1) {
      const frame = await port.frame()
      if (!frame.idle || frame.pendingFiniteAnimation || !frame.fontsLoaded) {
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

// A 32-bit FNV-1a hex string over the layout: one record per element and the page's own
// figures. Geometry is `offset*`, which ignores `transform`, so a running transition cannot
// enter by it. Self-contained on purpose (no module scope, no imports): `comparisons.mjs`
// passes this very function to `page.evaluate`, and only the hash crosses back.
export function signatureOf(records, page) {
  const text = JSON.stringify([
    records.map((r) => [r.tag, r.left, r.top, r.width, r.height, r.text]),
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
