// The probe a design capture installs in every page before its own scripts run (ADR-0042).
// Kept in its own module so a test can install it on a stand-in for `window`; the capture
// serialises `pageProbe` with `toString()` into `addInitScript`, so it is self-contained on
// purpose: no imports and no reference to anything outside the function.

// Before any page script runs: a count of the page's own `fetch` calls in flight (the one
// request channel the built app uses, ADR-0042), one boolean for "the DOM was mutated since the
// last frame" and the layout signature, so the frame loop can ask them without sending any
// page text out.
export function pageProbe(signature) {
  let inFlight = 0
  let waiting = []
  // Requests completed, and the value `__captureQuiet` last reported (null before its first call).
  let completed = 0
  let reported = null
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
      completed += 1
      if (inFlight === 0) release()
    }
    let result
    try {
      result = original.apply(this, args)
    } catch (error) {
      done()
      throw error
    }
    // Attached here, before the promise is returned, so this clone is made before the app's
    // own continuation runs and never meets a body the app has already read. A request is in
    // flight until that read ends, or until it fails.
    result.then((response) => {
      try {
        response.clone().arrayBuffer().then(done, done)
      } catch {
        done()
      }
    }, done)
    return result
  }
  // Waits for no request in flight, then says whether none completed since the previous call.
  // A frame in which one did has not drawn its answer yet (the app's notify is a timer on the
  // paused clock), so the first call after a navigation, with no previous value, is not quiet.
  window.__captureQuiet = async () => {
    while (inFlight > 0) await new Promise((resolve) => waiting.push(resolve))
    const quiet = reported === completed
    reported = completed
    return quiet
  }
  // One observer on the whole document, keeping one boolean. `takeRecords` hands over the
  // records the browser has queued but not yet delivered, so a mutation made just before a read
  // is never missed. The read resets the flag in the same call; only the boolean crosses back.
  let mutated = false
  const observer = new window.MutationObserver(() => {
    mutated = true
  })
  observer.observe(window.document, { attributes: true, childList: true, characterData: true, subtree: true })
  window.__captureMutated = () => {
    const since = mutated || observer.takeRecords().length > 0
    mutated = false
    return since
  }
  window.__captureSignature = signature
}
