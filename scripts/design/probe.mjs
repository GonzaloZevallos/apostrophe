// The probe a design capture installs in every page before its own scripts run (ADR-0042).
// Kept in its own module so a test can install it on a stand-in for `window`; the capture
// serialises `pageProbe` with `toString()` into `addInitScript`, so it is self-contained on
// purpose: no imports and no reference to anything outside the function.

// Before any page script runs: a count of the page's own `fetch` calls in flight (the one
// request channel the built app uses, ADR-0042) and the layout signature, so the frame
// loop can ask both without sending any page text out.
export function pageProbe(signature) {
  let inFlight = 0
  let waiting = []
  const release = () => {
    const ready = waiting
    waiting = []
    for (const resolve of ready) resolve()
  }
  const original = window.fetch
  window.fetch = function (...args) {
    inFlight += 1
    const done = () => {
      inFlight -= 1
      if (inFlight === 0) release()
    }
    let result
    try {
      result = original.apply(this, args)
    } catch (error) {
      done()
      throw error
    }
    result.then(done, done)
    return result
  }
  window.__captureInFlight = () => inFlight
  window.__captureIdle = async () => {
    while (inFlight > 0) await new Promise((resolve) => waiting.push(resolve))
  }
  window.__captureSignature = signature
}
