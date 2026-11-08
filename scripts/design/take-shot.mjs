// How one side of a row is shot (agentic-system ADR-0040, docs/adr/0052): the settle, the probe
// and the paused clock a capture runs on, and `takeShot`, which decides nothing itself: `shot.mjs`
// decides each step, `shot-page.mjs` reads the page. Moved out of `comparisons.mjs`, which keeps the
// registry loop and the index.
//
// The two values a run sets once, the wall-clock bound of one step and the instant the paused clock
// stands at, come from `configureShot`; without it a step is bounded at 8 s.

import { pageProbe } from './probe.mjs'
import {
  SETTLE_BOUND,
  SETTLE_FRAMES,
  SETTLE_QUIET_HOPS,
  SETTLE_REASON_UNSETTLED,
  animationRecords,
  frameRecords,
  settleWith,
  shotKept,
  signatureOf,
  sideOutcome,
  unfinished,
} from './settle.mjs'
import { TOLERANCE, gatherInPage, unscaled } from './textScale.mjs'
import {
  PROBE_CSS,
  coversScreen,
  layerMiss,
  planShot,
  regionMiss,
  shotStepReason,
  sizeRecordMiss,
  viewportMovedReason,
  viewportUnchanged,
} from './shot.mjs'
import { allElements, fixedInPage, layerReadInPage, readMetrics, sameNodesInPage, snapshotInPage } from './shot-page.mjs'

// The wall-clock bound of one step and the instant the clock is paused at, set once per run.
let TIMEOUT = 8000
let CAPTURE_INSTANT = null

export function configureShot({ timeoutMs, instant }) {
  TIMEOUT = timeoutMs
  CAPTURE_INSTANT = instant
}

// Installed and paused before any page exists, so the page starts on the capture's instant
// and no timer fires until the capture advances the clock.
export async function pauseClock(context) {
  await context.clock.install({ time: new Date(CAPTURE_INSTANT.getTime() - 1000) })
  await context.clock.pauseAt(CAPTURE_INSTANT)
}

export async function addProbe(context) {
  await context.addInitScript(`(${pageProbe.toString()})(${signatureOf.toString()})`)
  await context.addInitScript((css) => {
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(css)
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
  }, PROBE_CSS)
}

// One frame of the fake clock, then what the page looks like, in this order: no request in
// flight and none completed since the previous frame (that answer is `idle`); every finite
// animation that is running or pending finished, and only those (`unfinished` decides, paused
// and infinite ones are never touched); one real macrotask so queued work has run, then
// `quietHops` more, so a commit that lands later still counts; the mutation flag read and reset;
// then only a hash and booleans go back. A frame that finished something or saw a mutation is
// never calm (`settle.mjs`). The caller sends this function to the page with the pure helpers
// from `settle.mjs` as its arguments, all by `toString()`.
function sampleFrame(frameRecords, animationRecords, unfinished, quietHops) {
  return (async () => {
    const idle = await window.__captureQuiet()
    const flagged = unfinished(animationRecords(document))
    let unfinishedAnimation = false
    document.getAnimations().forEach((animation, index) => {
      if (!flagged[index]) return
      unfinishedAnimation = true
      try {
        animation.finish()
      } catch {
        // Nothing to do: the frame already counts as not calm.
      }
    })
    for (let hop = 0; hop <= quietHops; hop += 1) {
      await new Promise((resolve) => {
        const channel = new MessageChannel()
        channel.port1.onmessage = () => resolve()
        channel.port2.postMessage(0)
      })
    }
    const mutated = window.__captureMutated()
    const fontsLoaded = document.fonts.status === 'loaded'
    return {
      idle,
      unfinishedAnimation,
      mutated,
      fontsLoaded,
      hash: window.__captureSignature(frameRecords(document), {
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        imagesComplete: [...document.images].every((i) => i.complete),
        fontsLoaded,
      }),
    }
  })()
}

const SAMPLE_FRAME_SOURCE = `(${sampleFrame})(${frameRecords}, ${animationRecords}, ${unfinished}, ${SETTLE_QUIET_HOPS})`

// The hash of each page's last settled frame, which the frame sampled after its screenshot
// must equal.
const settledHash = new WeakMap()

// A wait bound, not an assertion: a fetch that never settles must not hang the capture.
export function withinTimeout(promise) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), TIMEOUT)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

// `null` when the page has finished drawing, else a reason with no page data in it. In this
// order: the network once after a navigation, the applied-check (it loads fonts, so it runs
// before the clock moves), then the clock advance and the frame sampling.
export async function settle(page, { advanceMs, afterGoto = false, ofFirstText }) {
  if (afterGoto) {
    try {
      await page.waitForLoadState('networkidle')
    } catch (error) {
      return `la red no se aquietó: ${firstLine(error)}`
    }
  }
  const applied = await appliedCheck(page, ofFirstText)
  if (applied) return applied
  // Every face the page asked for has finished loading before the first frame is sampled.
  try {
    await withinTimeout(page.evaluate(() => document.fonts.ready.then(() => undefined)))
  } catch {
    return SETTLE_REASON_UNSETTLED
  }
  const clock = page.context().clock
  let lastHash = null
  const reason = await settleWith(
    {
      advance: (ms) => clock.runFor(ms),
      frame: async () => {
        await clock.runFor(16)
        const frame = await withinTimeout(page.evaluate(SAMPLE_FRAME_SOURCE))
        lastHash = frame.hash
        return frame
      },
    },
    { advanceMs, frames: SETTLE_FRAMES, bound: SETTLE_BOUND },
  )
  if (reason === null) settledHash.set(page, lastHash)
  return reason
}

// One more frame, sampled right after a screenshot with NO clock advance: a late refetch lands
// after the settled frames. The shot is kept only if that frame is calm (no mutation since the
// last settled frame included) and has the last settled frame's hash; any miss, or a frame that
// cannot be read, is the one rest failure (`null` when the page is still at rest). Nothing is
// discarded: the shot itself does not mutate the page (see `SHOT` and `hideCaret`).
export async function restAfterShot(page) {
  try {
    const frame = await withinTimeout(page.evaluate(SAMPLE_FRAME_SOURCE))
    return shotKept(frame, settledHash.get(page)) ? null : SETTLE_REASON_UNSETTLED
  } catch {
    return SETTLE_REASON_UNSETTLED
  }
}

export const firstLine = (error) => String(error?.code ?? error?.message ?? error).split('\n')[0]

// The page's own font family is applied: a loaded face of it, no face in error, and the
// weights 400 to 700 available for latin text. Returns a reason (no data in it) or null.
// The family is the first one of `document.body`; a design file sets its font on an inner
// block, not on the body, so there it is the first element that draws text.
async function appliedCheck(page, ofFirstText) {
  return page.evaluate(async (ofFirstText) => {
    const unquote = (name) => name.trim().replace(/^["']|["']$/g, '')
    const skipped = new Set(['SCRIPT', 'STYLE', 'TITLE', 'NOSCRIPT', 'TEMPLATE', 'HELMET'])
    const drawsText = (node) =>
      node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '' && !skipped.has(node.parentElement?.tagName ?? 'SCRIPT')
    let source = document.body
    if (ofFirstText) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (drawsText(node)) {
          source = node.parentElement
          break
        }
      }
    }
    const family = unquote(getComputedStyle(source).fontFamily.split(',')[0])
    const sample = 'Nueva venta'
    const weights = [400, 500, 600, 700]
    // A face the page does not use yet stays unloaded; asking for it makes `check` mean
    // "this weight is available", not "this page happens to draw it".
    await Promise.all(weights.map((w) => document.fonts.load(`${w} 16px '${family}'`, sample).catch(() => [])))
    const faces = [...document.fonts]
    if (faces.some((face) => face.status === 'error')) return 'una tipografía de la página quedó en error'
    if (!faces.some((face) => unquote(face.family) === family && face.status === 'loaded')) {
      return 'ninguna cara cargada de la tipografía de la página'
    }
    const missing = weights.filter((w) => !document.fonts.check(`${w} 16px '${family}'`, sample))
    if (missing.length) return `la tipografía de la página no está aplicada en los pesos ${missing.join(', ')}`
    return null
  }, ofFirstText)
}

export async function scaleMisses(page, s, side, when) {
  const misses = unscaled(await page.evaluate(gatherInPage), s.text_scale, TOLERANCE)
  return misses.length ? `texto al ${Math.round(s.text_scale * 100)} %: ${misses.length} elementos fuera de escala ${when} (${side})` : null
}

// The screenshot has been taken: the viewport must be the size it was at the final settle, the
// scaled text is checked once more, then the page must still be at rest; a miss in any discards it.
// `label` is the side in the text-scale note; `side` is the one in the shot's own reasons.
export const settledViewport = new WeakMap()

export async function verifyAfterShot(page, s, label, png, side) {
  if (!viewportUnchanged(settledViewport.get(page), page.viewportSize())) {
    return sideOutcome(viewportMovedReason(side), null)
  }
  const miss = s.text_scale ? await scaleMisses(page, s, label, 'después de la captura') : null
  return sideOutcome(miss ?? (await restAfterShot(page)), png)
}

// A section is cropped to its parent block. When a direct child sticks out of that block
// (a fixed-width card inside a padded column), the crop is the union of the block and its
// children, in page coordinates, so no line of the section is cut. Always a box, whole pixels
// outward, as `locator.screenshot()` rounds its own. Read before the final settle, so that the
// screenshot is the very next call after it.
export async function sectionClip(block) {
  return block.evaluate((el) => {
    const box = (e) => {
      const r = e.getBoundingClientRect()
      return { left: r.left + scrollX, top: r.top + scrollY, right: r.right + scrollX, bottom: r.bottom + scrollY }
    }
    // A child with no box (display:none, display:contents) sits at the origin: not a part of the section.
    const drawn = [...el.children].filter((c) => c.getBoundingClientRect().width > 0 || c.getBoundingClientRect().height > 0)
    const all = [box(el), ...drawn.map(box)]
    const left = Math.min(...all.map((b) => b.left))
    const top = Math.min(...all.map((b) => b.top))
    const right = Math.max(...all.map((b) => b.right))
    const bottom = Math.max(...all.map((b) => b.bottom))
    const x = Math.floor(left)
    const y = Math.floor(top)
    return { x, y, width: Math.ceil(right) - x, height: Math.ceil(bottom) - y }
  })
}

// Playwright's `caret: 'hide'` sets and restores a `style` attribute on the page's text inputs,
// a DOM mutation the probe would see in the frame after the shot. The caret is hidden instead by
// a constructed stylesheet (`hideCaret`), which is not a DOM mutation, and the shot leaves its
// own caret option alone: the pixels are the same and the page is untouched.
const SHOT = { animations: 'disabled', caret: 'initial' }

// A step of the shot that cannot finish is the side's failure, with a fixed reason and no error text.
const stepKind = (error) => (error?.message === 'timeout' || error?.name === 'TimeoutError' ? 'timeout' : 'error')

// Every read, resize and the shot itself run bounded by `withinTimeout`; the settle keeps its own bounds.
export const bounded = (promise) => withinTimeout(Promise.resolve(promise))

// Most reads of the page, one browser round trip each, that wait for the resize event of a growth.
const RESIZE_POLLS = 100

// Grows the viewport and waits until the page has been told: the resize event reaches the page on
// a later browser frame than `setViewportSize` returns on, and a page that follows it (the shell's
// visual-viewport pin writes a `style` on its layout) would otherwise mutate after the settle and
// the shot, and the frame after the shot would find it moving. The listener goes in before the
// resize and only sets a flag: no DOM is touched. A page that is never told is not waited on
// longer than the bound.
export async function growViewport(page, size) {
  await bounded(
    page.evaluate(() => {
      window.__captureResized = false
      ;(window.visualViewport ?? window).addEventListener('resize', () => { window.__captureResized = true }, { once: true })
    }),
  )
  await bounded(page.setViewportSize(size))
  for (let polls = 0; polls < RESIZE_POLLS; polls += 1) {
    if (await bounded(page.evaluate(() => window.__captureResized === true))) return
  }
}

// The before and after snapshots of the elements, matched by node identity through their handles.
export async function sizeSnapshot(page, handle) {
  return bounded(page.evaluate(snapshotInPage, handle))
}

export async function nodeIdentity(page, before, beforeHandle, after, afterHandle) {
  const afterAt = new Map(after.entries.map((entry) => [`${entry.path}\u0000${entry.ordinal}`, entry]))
  const pairs = []
  const matched = []
  for (const entry of before.entries) {
    const other = afterAt.get(`${entry.path}\u0000${entry.ordinal}`)
    if (other === undefined) continue
    pairs.push([entry.index, other.index])
    matched.push(other)
  }
  const same = await bounded(page.evaluate(sameNodesInPage, [beforeHandle, afterHandle, pairs]))
  matched.forEach((other, at) => {
    other.same_node = same[at]
  })
}

// How a shot is taken, the same for every row and both sides (`shot.mjs` decides each step; nothing here
// looks at the row, the file, the width or the kind of screen; `side` only names a failure). A layer
// over the screen is never grown: its frame must lie inside the viewport and nothing in it may be
// scrolled. Any other page grows the viewport once, to the height of the document at the same width
// (a full-page shot makes Chromium resize the viewport for a moment, and `captureBeyondViewport` does
// too: docs/adr/0052), settles, and only then is checked: the sizes before and after the growth, then
// that the region fits the viewport. The shot is a plain one, with the section's clip when there is one.
// A miss, a timeout included, is `sideOutcome(reason, null)`.
export async function takeShot(page, { block, ofFirstText, census, side }) {
  const handles = []
  try {
    if (census) await bounded(census.before(page))
    return await shotSteps(page, { block, ofFirstText, census, side }, handles)
  } catch (error) {
    return sideOutcome(shotStepReason(stepKind(error), side), null)
  } finally {
    await Promise.allSettled(handles.map((handle) => handle.dispose()))
  }
}

export async function shotSteps(page, { block, ofFirstText, census, side }, handles) {
  const viewport = page.viewportSize()
  const metrics = await bounded(page.evaluate(readMetrics))
  const beforeHandle = await bounded(page.evaluateHandle(allElements))
  handles.push(beforeHandle)
  const fixed = await bounded(page.evaluate(fixedInPage, beforeHandle))
  const plan = planShot(metrics, fixed, viewport)
  let before = null
  if (plan.mode === 'grow') {
    before = await sizeSnapshot(page, beforeHandle)
    if (plan.height !== viewport.height) {
      await growViewport(page, { width: viewport.width, height: plan.height })
    }
  }
  const clip = block ? await bounded(sectionClip(block)) : undefined
  const last = await settle(page, { advanceMs: 0, ofFirstText })
  if (last) return sideOutcome(last, null)
  settledViewport.set(page, page.viewportSize())
  let miss
  if (plan.mode === 'layer') {
    const covering = fixed.find((element) => coversScreen([element], viewport))
    const { frame, containers } = await bounded(page.evaluate(layerReadInPage, [beforeHandle, covering.index]))
    miss = layerMiss(frame, viewport, containers, side)
  } else {
    const afterHandle = await bounded(page.evaluateHandle(allElements))
    handles.push(afterHandle)
    const after = await sizeSnapshot(page, afterHandle)
    await nodeIdentity(page, before, beforeHandle, after, afterHandle)
    miss = sizeRecordMiss(before, after, side)
  }
  miss ??= regionMiss(await bounded(page.evaluate(readMetrics)), clip, side, { layer: plan.mode === 'layer' })
  if (miss) return sideOutcome(miss, null)
  census?.atShot(page)
  const png = await bounded(page.screenshot(clip === undefined ? SHOT : { ...SHOT, clip }))
  return sideOutcome(null, png)
}
