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
  kindOfSettle,
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
  hiddenRule,
  innerScrollMiss,
  layerMiss,
  named,
  pinnedClass,
  planShot,
  regionMiss,
  scrollPlan,
  shiftMiss,
  shotStepReason,
  sizeRecordMiss,
  stickyPlacement,
  stickyProbeOffset,
  viewportMovedReason,
  viewportUnchanged,
} from './shot.mjs'
import {
  adoptSheetInPage,
  allElements,
  dropSheetInPage,
  fixedInPage,
  layerReadInPage,
  pinnedInPage,
  readMetrics,
  readScroll,
  rectInPage,
  sameNodesInPage,
  scrollToInPage,
  scrollersInPage,
  snapshotInPage,
} from './shot-page.mjs'
import { stitch } from './stitch.mjs'

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

// `{ reason, kind }`: `reason` is `null` when the page has finished drawing, else a reason with no
// page data in it, and `kind` is the closed kind of that miss (`settle.mjs`), set here where the
// reason is produced. In this order: the network once after a navigation, the applied-check (it
// loads fonts, so it runs before the clock moves), then the clock advance and the frame sampling.
export async function settleKinded(page, { advanceMs, afterGoto = false, ofFirstText }) {
  if (afterGoto) {
    try {
      await page.waitForLoadState('networkidle')
    } catch (error) {
      return { reason: `la red no se aquietó: ${firstLine(error)}`, kind: 'network' }
    }
  }
  const applied = await appliedCheck(page, ofFirstText)
  if (applied) return { reason: applied, kind: 'other' }
  // Every face the page asked for has finished loading before the first frame is sampled.
  try {
    await withinTimeout(page.evaluate(() => document.fonts.ready.then(() => undefined)))
  } catch {
    return { reason: SETTLE_REASON_UNSETTLED, kind: 'unsettled' }
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
  return { reason, kind: reason === null ? null : kindOfSettle(reason) }
}

// The bare reason of `settleKinded`, as a string or `null`: what `census.mjs` is given.
export const settle = async (page, options) => (await settleKinded(page, options)).reason

// One more frame, sampled right after a screenshot with NO clock advance: a late refetch lands
// after the settled frames. The shot is kept only if that frame is calm (no mutation since the
// last settled frame included) and has the last settled frame's hash; any miss, or a frame that
// cannot be read, is the one rest failure (`reason: null` when the page is still at rest). Its kind
// says which: `rest-mismatch` for a frame that is not calm or whose hash differs, `rest-unread` for
// one that could not be read. Nothing is discarded: the shot itself does not mutate the page (see
// `SHOT` and `hideCaret`).
export async function restAfterShot(page) {
  let frame
  try {
    frame = await withinTimeout(page.evaluate(SAMPLE_FRAME_SOURCE))
  } catch {
    return { reason: SETTLE_REASON_UNSETTLED, kind: 'rest-unread' }
  }
  return shotKept(frame, settledHash.get(page))
    ? { reason: null, kind: null }
    : { reason: SETTLE_REASON_UNSETTLED, kind: 'rest-mismatch' }
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
  if (miss) return sideOutcome(miss, null)
  const rest = await restAfterShot(page)
  return sideOutcome(rest.reason, png, rest.kind)
}

// A section is cropped to its parent block. When a direct child sticks out of that block
// (a fixed-width card inside a padded column), the box is the union of the block and its
// children, in page coordinates, so no line of the section is cut. Not rounded: the grow path
// rounds it in `sectionClip` and the scroll path leaves that to `scrollPlan`. Read before the final
// settle, so that the screenshot is the very next call after it.
export async function sectionBox(block) {
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
    return { x: left, y: top, width: right - left, height: bottom - top, right, bottom }
  })
}

// The grow path's crop: that box, a whole pixel outward on every side, as `locator.screenshot()` rounds its own.
export async function sectionClip(block) {
  const box = await sectionBox(block)
  const x = Math.floor(box.x)
  const y = Math.floor(box.y)
  return { x, y, width: Math.ceil(box.right) - x, height: Math.ceil(box.bottom) - y }
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
    const kind = stepKind(error)
    return kind === 'timeout'
      ? sideOutcome(shotStepReason(kind, side), null, 'shot-timeout')
      : sideOutcome(shotStepReason(kind, side), null)
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
  if (plan.mode === 'scroll') return scrollShot(page, { block, ofFirstText, census, side }, handles)
  let before = null
  if (plan.mode === 'grow') {
    before = await sizeSnapshot(page, beforeHandle)
    if (plan.height !== viewport.height) {
      await growViewport(page, { width: viewport.width, height: plan.height })
    }
  }
  const clip = block ? await bounded(sectionClip(block)) : undefined
  const last = await settleKinded(page, { advanceMs: 0, ofFirstText })
  if (last.reason) return sideOutcome(last.reason, null, last.kind)
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

// Moves the document to `offset` and waits until the page is at rest there. `{ reason, kind }`.
async function scrollSettled(page, offset, ofFirstText) {
  await bounded(page.evaluate(scrollToInPage, offset))
  return settleKinded(page, { advanceMs: 0, ofFirstText })
}

// What `shiftMiss` reads of the page now: where it is scrolled, its size, and the snapshot of its elements
// matched by node identity against `first` (the snapshot at the top, with its handle) when there is one.
async function readFrame(page, offset, handles, first) {
  const handle = await bounded(page.evaluateHandle(allElements))
  handles.push(handle)
  const [scroll, snapshot] = await Promise.all([bounded(page.evaluate(readScroll)), sizeSnapshot(page, handle)])
  if (first !== null) await nodeIdentity(page, first.read.snapshot, first.handle, snapshot, handle)
  // The snapshot's tops are page tops; `shiftMiss` reads them from the viewport and adds the scroll itself.
  const entries = snapshot.entries.map((entry) => ({ ...entry, top: entry.top - scroll.scrollTop }))
  return { read: { offset, ...scroll, vvAlto: snapshot.vvAlto, snapshot: { ...snapshot, entries } }, handle }
}

// Where a sticky element sits when it is not stuck: its page top and bottom at the offset the probe
// scrolled to, or null when it is stuck there (the page cannot show it at a place of its own).
function naturalPlace(pinned, rect, scrollTop, viewport) {
  const stuck =
    typeof pinned.insetTop === 'number'
      ? rect.top < pinned.insetTop
      : typeof pinned.insetBottom === 'number' && rect.bottom + pinned.insetBottom > viewport.height
  return stuck ? null : { top: rect.top + scrollTop, bottom: rect.bottom + scrollTop }
}

// A phone page at its real viewport, frame by frame (docs/adr/0052, GH-491). The viewport is never
// changed. Every decision is `shot.mjs`'s: `planShot` chose this path, `scrollPlan` the frames,
// `stickyPlacement` where each pinned element is drawn, `hiddenRule` the stylesheet of each frame
// and `shiftMiss` whether the page held still. Nothing here rounds: `stitch` copies rows.
async function scrollShot(page, { block, ofFirstText, census, side }, handles) {
  const refused = (reason, kind) => sideOutcome(reason, null, kind)
  const viewport = page.viewportSize()
  let last = await scrollSettled(page, 0, ofFirstText)
  if (last.reason) return refused(last.reason, last.kind)
  settledViewport.set(page, page.viewportSize())
  const clip = block ? await bounded(sectionBox(block)) : undefined
  const dpr = await bounded(page.evaluate(() => window.devicePixelRatio))
  const top = await readFrame(page, 0, handles, null)
  const metrics = await bounded(page.evaluate(readMetrics))
  const scrollers = await bounded(page.evaluate(scrollersInPage, top.handle))
  const inner = innerScrollMiss(metrics, scrollers, side)
  if (inner) return refused(inner)
  const pinned = await bounded(page.evaluate(pinnedInPage, top.handle))
  const maxOffset = Math.max(0, metrics.scrollHeight - viewport.height)
  const unplaced = refused(named('a pinned element could not be placed', side))
  for (const element of pinned.filter((p) => pinnedClass(p) === 'content')) {
    last = await scrollSettled(page, stickyProbeOffset(element, viewport, maxOffset), ofFirstText)
    if (last.reason) return refused(last.reason, last.kind)
    const [rect, { scrollTop }] = await Promise.all([
      bounded(page.evaluate(rectInPage, [top.handle, element.index])),
      bounded(page.evaluate(readScroll)),
    ])
    element.natural = naturalPlace(element, rect, scrollTop, viewport)
    if (element.natural === null) return unplaced
  }
  last = await scrollSettled(page, 0, ofFirstText)
  if (last.reason) return refused(last.reason, last.kind)
  const again = await readFrame(page, 0, handles, top)
  const moved = shiftMiss(top.read, again.read, side)
  if (moved) return refused(moved)
  const frames = framesOf(metrics, viewport, dpr, clip, pinned, side)
  if ('reason' in frames) return refused(frames.reason)
  const placed = stickyPlacement(pinned, frames.frames, viewport, side, dpr)
  if ('reason' in placed) return refused(placed.reason)
  census?.atShot(page)
  const shots = []
  for (const [at, frame] of frames.frames.entries()) {
    last = await scrollSettled(page, frame.offset, ofFirstText)
    if (last.reason) return refused(last.reason, last.kind)
    const sheet = await bounded(page.evaluateHandle(adoptSheetInPage, hiddenRule(placed.units, at, placed.assignment)))
    try {
      const now = await readFrame(page, frame.offset, handles, top)
      const miss = shiftMiss(top.read, now.read, side)
      if (miss) return refused(miss)
      shots.push(await bounded(page.screenshot(SHOT)))
    } finally {
      await Promise.allSettled([page.evaluate(dropSheetInPage, sheet).then(() => sheet.dispose())])
    }
  }
  last = await scrollSettled(page, 0, ofFirstText)
  if (last.reason) return refused(last.reason, last.kind)
  return sideOutcome(null, stitch(shots, frames.frames, dpr))
}

// The frames of the page: the plan without any break first, then one break at the natural top of each
// sticky element that a frame would cut, so that every sticky element sits whole in one frame. An
// element that still does not fit is left to `stickyPlacement`, which refuses it.
function framesOf(metrics, viewport, dpr, clip, pinned, side) {
  const sticky = pinned.filter((p) => pinnedClass(p) === 'content')
  const first = scrollPlan(metrics, viewport, dpr, clip, [], side)
  if ('reason' in first) return first
  const range = (frame) => [(frame.offset * dpr + frame.cropTop) / dpr, (frame.offset * dpr + frame.cropTop + frame.cropHeight) / dpr]
  const cut = sticky.filter((p) =>
    first.frames.some((frame) => {
      const [from, to] = range(frame)
      return p.natural.top < to && p.natural.bottom > from && !(p.natural.top >= from && p.natural.bottom <= to)
    }),
  )
  return scrollPlan(metrics, viewport, dpr, clip, cut.map((p) => p.natural.top), side)
}
