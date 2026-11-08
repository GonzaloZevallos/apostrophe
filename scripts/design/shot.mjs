// How a design capture takes its shot (GH-338, GH-301). Pure: no Playwright, no DOM, no fs. The browser
// and the files live in `comparisons.mjs` and `census.mjs`, which hand these functions numbers
// and read their answers. Nothing here carries page text: only paths, ordinals, sizes, counts
// and booleans.

import { SETTLE_REASON_REJECTED, SETTLE_REASON_UNSETTLED } from './settle.mjs'

// The calm page of every capture, phone and desktop, both sides (GH-491). `CALM_CONTEXT` goes into
// the options of each context (`captureContextOptions`); `CALM_CSS` zeroes every animation and
// transition; `PROBE_CSS` is the one rule sheet the probe adopts: the caret rule plus the calm
// rule. Only `adoptedStyleSheets` carries it, never a `<style>` node or an attribute, so the
// probe sees no mutation. Nothing else defines these values.
export const CALM_CONTEXT = Object.freeze({ reducedMotion: 'reduce' })
// The device scale factor of every capture context; `comparisons.mjs` reads it for the sheet's column widths.
export const CAPTURE_SCALE = 2
export const CALM_CSS =
  '*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; }'
export const PROBE_CSS = `*, *::before, *::after { caret-color: transparent !important; }\n${CALM_CSS}`

// The options of one row's design and built contexts: the same for both, whatever the row.
export function captureContextOptions({ width, height, url }) {
  return { viewport: { width, height }, deviceScaleFactor: CAPTURE_SCALE, colorScheme: 'light', baseURL: url, ...CALM_CONTEXT }
}

// The height the viewport grows to so a tall page fits it: the document's own, same width.
// Null when the document already fits.
export function grownHeight(metrics, viewport) {
  return metrics.scrollHeight > viewport.height ? metrics.scrollHeight : null
}

// Whether a fixed element counts as a layer over the screen. All in CSS px and exact, with no
// tolerance: displayed, visible, opacity above 0, and its intersection with the viewport spans
// the full width and at least half the height. Evaluated before any growth of the viewport.
export function coversScreen(fixedElements, viewport) {
  return fixedElements.some((element) => {
    if (element.display === 'none') return false
    if (element.visibility !== 'visible') return false
    if (!(element.opacity > 0)) return false
    const { left, top, right, bottom } = element.rect
    const width = Math.min(right, viewport.width) - Math.max(left, 0)
    const height = Math.min(bottom, viewport.height) - Math.max(top, 0)
    return width >= viewport.width && 2 * height >= viewport.height
  })
}

const keyOf = (entry) => `${entry.path}\u0000${entry.ordinal}`
const sizeOf = (entry) => ({ width: entry.width, height: entry.height })
// Flags named like a field of the change itself are dropped, so they cannot shadow it.
const flagsOf = ({
  index: _index,
  top: _top,
  path: _path,
  ordinal: _ordinal,
  width: _width,
  height: _height,
  before: _before,
  after: _after,
  kind: _kind,
  ...flags
}) => flags

// The elements whose size differs between two snapshots, matched on tag-and-class path plus
// their ordinal among same-path elements in document order. An element on one side only has
// null on the other; each path whose count differs is its own entry.
export function sizesChanged(before, after) {
  const afterByKey = new Map(after.entries.map((entry) => [keyOf(entry), entry]))
  const beforeKeys = new Set(before.entries.map(keyOf))
  const changes = []
  for (const entry of before.entries) {
    const other = afterByKey.get(keyOf(entry))
    if (other === undefined) {
      changes.push({ ...flagsOf(entry), path: entry.path, ordinal: entry.ordinal, before: sizeOf(entry), after: null })
    } else if (entry.width !== other.width || entry.height !== other.height) {
      changes.push({
        ...flagsOf(entry),
        path: entry.path,
        ordinal: entry.ordinal,
        before: sizeOf(entry),
        after: sizeOf(other),
      })
    }
  }
  for (const entry of after.entries) {
    if (!beforeKeys.has(keyOf(entry))) {
      changes.push({ ...flagsOf(entry), path: entry.path, ordinal: entry.ordinal, before: null, after: sizeOf(entry) })
    }
  }
  const paths = new Set([...Object.keys(before.counts), ...Object.keys(after.counts)])
  for (const path of [...paths].sort()) {
    const was = before.counts[path] ?? 0
    const now = after.counts[path] ?? 0
    if (was !== now) changes.push({ path, kind: 'count', before: was, after: now })
  }
  return changes
}

// Why a page does not fit its viewport after the growth, in fixed English with no numbers; null
// when it fits. Census mode only.
export function fitsViewport(metrics) {
  if (metrics.scrollWidth > metrics.innerWidth) return 'page wider than its viewport'
  if (metrics.scrollHeight > metrics.innerHeight) return 'page taller than its viewport'
  return null
}

// The class of a census row: a layer over the screen first, then a page that was grown, then a
// page wider than its viewport, else neither.
export function censusClass({ layer, grown, wide }) {
  if (layer) return 'layer'
  if (grown) return 'grown'
  if (wide) return 'wide'
  return 'neither'
}

// The widths below this are a phone: its page is scrolled and stitched instead of grown (GH-491).
const PHONE_BELOW = 900

// What a shot does, decided before anything moves, and the only branch on the class of a row: a layer
// over the screen is shot as it is, never grown or scrolled; any other page below `PHONE_BELOW` wide is
// scrolled at its real viewport and stitched; the rest grows the viewport to the document's height,
// same width (the current height when the document already fits).
export function planShot(metrics, fixedElements, viewport) {
  if (coversScreen(fixedElements, viewport)) return { mode: 'layer' }
  if (viewport.width < PHONE_BELOW) return { mode: 'scroll' }
  return { mode: 'grow', height: grownHeight(metrics, viewport) ?? viewport.height }
}

// Pinned elements: the fixed and the sticky ones of a page, as the page reader reports them (never
// text): `{ chain, position, insetTop, insetBottom, marginTop, marginBottom, transform, rect, container,
// natural? }`. `chain` is a `:nth-child` selector path, each step joined by ' > '; insets and margins are
// a px number or 'auto'; `rect` is the viewport rect at the first frame; `container` is the parent's
// content box in page px; `natural` is a sticky element's `{ top, bottom }` in page px where it sits
// when it is not stuck.
//
// The one place that classifies a pinned element: fixed is chrome (drawn on frame 0, hidden after,
// takes no flow space), sticky is content (drawn once, at its natural place). Only the element's own
// computed position counts: no selector, no containing block.
export function pinnedClass(pinned) {
  if (pinned.position === 'fixed') return 'chrome'
  if (pinned.position === 'sticky') return 'content'
  throw new Error('shot: not a pinned position')
}

// How far a fixed element's rect may stray from its insets to count as sitting on the viewport: a
// comparison of layout values, not a rounding.
const VIEWPORT_FIXED_SLOP = 0.5

// Whether a fixed element sits where its own insets put it in the viewport. A transformed ancestor
// becomes its containing block and moves it off both equations; an element with both insets `auto`
// has no equation at all. Neither is provably viewport-fixed.
export function viewportFixed(pinned, viewport) {
  const { insetTop, insetBottom, marginTop, marginBottom, rect } = pinned
  const numbers = (...values) => values.every((value) => typeof value === 'number')
  const onTop = numbers(insetTop, marginTop) && Math.abs(rect.top - (insetTop + marginTop)) <= VIEWPORT_FIXED_SLOP
  const onBottom =
    numbers(insetBottom, marginBottom) &&
    Math.abs(rect.bottom - (viewport.height - insetBottom - marginBottom)) <= VIEWPORT_FIXED_SLOP
  return onTop || onBottom
}

const clamp = (value, low, high) => Math.min(Math.max(value, low), high)

// The scroll offset at which a sticky element sits at its natural place, not stuck: its container's
// content bottom (bottom-sticky) or top (top-sticky) meets the inset. A sticky element with no
// inset never sticks; its place is read at the top. Both insets set counts as top-sticky.
export function stickyProbeOffset(pinned, viewport, maxOffset) {
  const { insetTop, insetBottom, container } = pinned
  if (typeof insetTop === 'number') return clamp(container.contentTop - insetTop, 0, maxOffset)
  if (typeof insetBottom === 'number') {
    return clamp(container.contentBottom + insetBottom - viewport.height, 0, maxOffset)
  }
  return 0
}

// The frames of a scrolled shot: `{ frames: [{ offset, cropTop, cropHeight }] }`, or `{ reason }` for a
// shot that cannot be planned. An offset is a whole CSS px (a scroll position); a crop is whole device
// px, rows of that frame's screenshot. The frames start at 0 (or at the clip's y), step by the viewport
// height, break where a boundary falls inside a step, and the last offset is clamped to
// `scrollHeight - height` with the overlap cropped away, so every page row lands in exactly one frame.
// `boundaries` are page y values (CSS px). With a clip the frames cover its vertical range only.
// This is the only place a shot rounds: starts go down to a whole CSS px, ends go up to a whole device px.
export function scrollPlan(metrics, viewport, dpr, clip, boundaries, side) {
  if (!Number.isInteger(dpr) || dpr < 1) return { reason: named('device scale factor is not a whole number', side) }
  const documentHeight = Math.max(Math.ceil(metrics.scrollHeight), viewport.height)
  const frameHeight = viewport.height * dpr
  const maxOffset = documentHeight - viewport.height
  let start = 0
  let end = documentHeight * dpr
  if (clip !== undefined && clip !== null) {
    const within =
      clip.x >= 0 && clip.y >= 0 && clip.x + clip.width <= viewport.width && clip.y + clip.height <= documentHeight
    if (!within) return { reason: named('section outside the viewport', side) }
    start = Math.floor(clip.y) * dpr
    end = Math.ceil((clip.y + clip.height) * dpr)
  }
  const breaks = [...new Set(boundaries.map((boundary) => Math.floor(boundary) * dpr))].sort((a, b) => a - b)
  const frames = []
  for (let cursor = start; cursor < end; ) {
    const limit = cursor + frameHeight
    const cut = breaks.find((at) => at > cursor && at < limit && at < end)
    const to = cut ?? Math.min(limit, end)
    const offset = Math.min(cursor / dpr, maxOffset)
    frames.push({ offset, cropTop: cursor - offset * dpr, cropHeight: to - cursor })
    cursor = to
  }
  return { frames }
}

// The hiding units of a page's pinned elements: each pinned element that has no ancestor pinned the
// same way (a fixed inside a fixed, a sticky inside a sticky, belongs to the outer one). A fixed
// element inside a sticky one is a unit of its own: it is chrome.
function inside(inner, outer) {
  return inner.chain.startsWith(`${outer.chain} > `)
}

function pinnedUnits(pinned) {
  return pinned.filter((element) => !pinned.some((other) => pinnedClass(other) === pinnedClass(element) && inside(element, other)))
}

// Where each pinned unit is drawn: `{ units: [{ chain, position }], assignment }` with one frame index
// per unit (-1 for a sticky element wholly outside the region of a clip, drawn on none), or `{ reason }`.
// Chrome goes to frame 0; content goes to the frame whose crop holds its natural rect whole. Anything
// that cannot be placed so is refused as `a pinned element could not be placed`: a gap or a double
// drawing is never accepted. `plan` is the frames of `scrollPlan`; `dpr` reads their device-px crops.
export function stickyPlacement(pinned, plan, viewport, side, dpr = CAPTURE_SCALE) {
  const refused = { reason: named('a pinned element could not be placed', side) }
  const ranges = plan.map((frame) => ({
    from: (frame.offset * dpr + frame.cropTop) / dpr,
    to: (frame.offset * dpr + frame.cropTop + frame.cropHeight) / dpr,
  }))
  if (ranges.length === 0) return refused
  // Two boundaries conflict when the frames do not meet: a gap or an overlap would be drawn twice or never.
  if (ranges.some((range, at) => at > 0 && range.from !== ranges[at - 1].to)) return refused
  const shown = { from: ranges[0].from, to: ranges[ranges.length - 1].to }
  const units = pinnedUnits(pinned)
  const assignment = []
  for (const unit of units) {
    const frame = placeUnit(unit, pinned, { plan, ranges, shown, viewport, dpr })
    if (frame === null) return refused
    assignment.push(frame)
  }
  return { units: units.map(({ chain, position }) => ({ chain, position })), assignment }
}

function placeUnit(unit, pinned, { plan, ranges, shown, viewport, dpr }) {
  if (pinnedClass(unit) === 'chrome') return chromeOnFrameZero(unit, plan[0], viewport, dpr) ? 0 : null
  if (pinned.some((other) => pinnedClass(other) === 'chrome' && inside(unit, other))) return null
  if (unit.natural === undefined) return null
  const { top, bottom } = unit.natural
  if (bottom - top > viewport.height) return null
  if (bottom <= shown.from || top >= shown.to) return -1
  const frame = ranges.findIndex((range) => top >= range.from && bottom <= range.to)
  return frame === -1 ? null : frame
}

function chromeOnFrameZero(unit, frame, viewport, dpr) {
  if (unit.transform !== 'none' || !viewportFixed(unit, viewport)) return false
  const { left, top, right, bottom } = unit.rect
  const cropTop = frame.cropTop / dpr
  const cropBottom = (frame.cropTop + frame.cropHeight) / dpr
  return Math.min(right, viewport.width) > Math.max(left, 0) && Math.min(bottom, cropBottom) > Math.max(top, cropTop)
}

// The stylesheet text that draws each pinned unit once, for one frame: the units not on it are
// hidden (the unit, its descendants and their pseudo-elements), through `visibility: hidden
// !important`. Only text: the page adopts it as a constructed stylesheet and no node or attribute
// changes. A fixed unit that is on this frame and sits inside a unit hidden on it is left out of the
// hiding by `:not(...)` and set visible, because `visibility` is inherited. `units` and `assignment`
// come from `stickyPlacement`.
export function hiddenRule(units, frameIndex, assignment) {
  const hidden = units.filter((_unit, at) => assignment[at] !== frameIndex)
  const kept = units.filter((unit, at) => assignment[at] === frameIndex && pinnedClass(unit) === 'chrome')
  const rules = hidden.map((unit) => {
    const keep = kept.filter((fixedUnit) => inside(fixedUnit, unit))
    const skip = keep.length === 0 ? '' : `:not(${keep.map(({ chain }) => `${chain}, ${chain} *`).join(', ')})`
    const { chain } = unit
    const selectors = [chain, `${chain} *${skip}`, `${chain}::before`, `${chain}::after`, `${chain} *${skip}::before`, `${chain} *${skip}::after`]
    return `${selectors.join(', ')} { visibility: hidden !important }`
  })
  for (const unit of kept) {
    if (!hidden.some((outer) => inside(unit, outer))) continue
    const { chain } = unit
    rules.push(`${chain}, ${chain}::before, ${chain}::after { visibility: visible !important }`)
  }
  return rules.join('\n')
}

// The fixed English reasons of a shot that cannot be taken. Each names the side (`design` or
// `built`) and nothing else: no page text, no number, no error text. `what` comes from this closed
// table and `named` is the only place a `shot:` line is built: any other `what` is a bug.
const WHATS = new Set([
  'layer frame outside the viewport',
  "a layer's content is scrolled",
  'page wider than its viewport',
  'page taller than its viewport',
  'section outside the viewport',
  'the page changed when the viewport grew',
  'the viewport changed during the shot',
  'timed out taking the shot',
  'could not take the shot',
  'no built screen yet',
  'did not settle',
  'a pinned element could not be placed',
  'device scale factor is not a whole number',
  'the page changed while it was shot',
  'the page scrolls inside an element',
])
const SIDES = ['design', 'built']

export function named(what, side) {
  if (!WHATS.has(what) || !SIDES.includes(side)) throw new Error('shot: a reason outside the fixed table')
  return `shot: ${what} (${side})`
}

// The fixed reason a failed side records in `index.json`, by exact membership and never by prefix:
// a line of the table for this side stays as it is; the settle's two reasons are `did not settle`;
// anything else, page text and error text included, is `could not take the shot`.
export function shotReason(failure, side) {
  if ([...WHATS].some((what) => failure === named(what, side))) return failure
  if (failure === SETTLE_REASON_UNSETTLED || failure === SETTLE_REASON_REJECTED) return named('did not settle', side)
  return named('could not take the shot', side)
}

// Whether a row has both PNGs, and why a side has none. Each side is `{ path, reason }`; a side's
// reason is kept only when its path is null. The only place `capture` is computed.
export function rowCapture({ design, built }) {
  const reasons = {}
  if (design.path === null && design.reason) reasons.design = design.reason
  if (built.path === null && built.reason) reasons.built = built.reason
  const capture = design.path !== null && built.path !== null ? 'captured' : 'not-captured'
  return Object.keys(reasons).length ? { capture, reasons } : { capture }
}

// A layer's frame must lie inside the viewport and nothing inside it may be scrolled. A list that
// scrolls inside the layer by design, shown at its top, passes. `containers` is every element inside
// the layer, as `{ scrollTop }`, whatever its overflow.
export function layerMiss(frame, viewport, containers, side) {
  const inside =
    frame.left >= 0 && frame.top >= 0 && frame.right <= viewport.width && frame.bottom <= viewport.height
  if (!inside) return named('layer frame outside the viewport', side)
  if (containers.some((container) => container.scrollTop !== 0)) return named("a layer's content is scrolled", side)
  return null
}

// The region of the shot lies inside the viewport: with no clip the whole document fits it in both
// axes, with a clip the section does. A layer is shot at the viewport itself and the document behind
// it may scroll, so with `layer` and no clip there is nothing to check here (`layerMiss` checks it).
export function regionMiss(metrics, clip, side, { layer = false } = {}) {
  if (clip === undefined || clip === null) {
    if (layer) return null
    const reason = fitsViewport(metrics)
    return reason === null ? null : named(reason, side)
  }
  const inside =
    clip.x >= 0 && clip.y >= 0 && clip.x + clip.width <= metrics.innerWidth && clip.y + clip.height <= metrics.innerHeight
  return inside ? null : named('section outside the viewport', side)
}

// The size rule, on drawn elements, before and after the viewport grew: the page may only have
// become taller. A miss is a top that moves (an element that is fixed or sticky, or inside one,
// is exempt from the top only), a width that changes, a height that shrinks, a node that was
// replaced, or a path whose count changed. Records are `{ path, ordinal, top, width, height,
// pinned, same_node }` plus the count per path.
export function sizeRecordMiss(before, after, side) {
  const afterByKey = new Map(after.entries.map((entry) => [keyOf(entry), entry]))
  const missed = before.entries.some((entry) => {
    const other = afterByKey.get(keyOf(entry))
    if (other === undefined) return true
    if (entry.same_node === false || other.same_node === false) return true
    if (entry.width !== other.width || other.height < entry.height) return true
    return entry.top !== other.top && !(entry.pinned && other.pinned)
  })
  const paths = new Set([...Object.keys(before.counts), ...Object.keys(after.counts)])
  const recounted = [...paths].some((path) => (before.counts[path] ?? 0) !== (after.counts[path] ?? 0))
  return missed || recounted ? named('the page changed when the viewport grew', side) : null
}

// The page between two frames of a scrolled shot: `frame` is `{ offset, scrollTop, scrollHeight,
// viewport, vvAlto, snapshot }`, the planned offset, what the page reports, and the size snapshot
// (`{ entries, counts }`, entries as in `sizeRecordMiss` plus `same_node` from the identity pass).
// A miss is a scroll that did not land, a document or viewport that changed, a different inline
// `--vv-alto`, a count that changed, an element that is not pinned whose page top (`top + scrollTop`),
// width or height changed or whose node was replaced, or a pinned element whose size changed (its top
// moves with the scroll and is not compared).
const PAGE_TOP_SLOP = 1e-6

export function shiftMiss(frame0, frameN, side) {
  const missed =
    frame0.scrollTop !== frame0.offset ||
    frameN.scrollTop !== frameN.offset ||
    frame0.scrollHeight !== frameN.scrollHeight ||
    frame0.viewport.width !== frameN.viewport.width ||
    frame0.viewport.height !== frameN.viewport.height ||
    frame0.vvAlto !== frameN.vvAlto ||
    entriesShifted(frame0, frameN) ||
    countsChanged(frame0.snapshot.counts, frameN.snapshot.counts)
  return missed ? named('the page changed while it was shot', side) : null
}

function entriesShifted(frame0, frameN) {
  const byKey = new Map(frameN.snapshot.entries.map((entry) => [keyOf(entry), entry]))
  return frame0.snapshot.entries.some((entry) => {
    const other = byKey.get(keyOf(entry))
    if (other === undefined) return true
    if (entry.same_node === false || other.same_node === false) return true
    if (entry.width !== other.width || entry.height !== other.height) return true
    if (Boolean(entry.pinned) !== Boolean(other.pinned)) return true
    if (entry.pinned) return false
    return Math.abs(entry.top + frame0.scrollTop - (other.top + frameN.scrollTop)) > PAGE_TOP_SLOP
  })
}

function countsChanged(before, after) {
  const paths = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...paths].some((path) => (before[path] ?? 0) !== (after[path] ?? 0))
}

// A scrolled shot has one scroller, the document. An element outside any layer that scrolls (its
// content taller than itself) while the document does not hides the page behind its own scrollbar,
// and no frame would show the rest. `scrollers` are those elements as `{ scrollHeight, clientHeight }`.
export function innerScrollMiss(metrics, scrollers, side) {
  if (metrics.scrollHeight > metrics.innerHeight) return null
  const scrolls = scrollers.some((element) => element.scrollHeight > element.clientHeight)
  return scrolls ? named('the page scrolls inside an element', side) : null
}

// The viewport is the size it was at the final settle.
export function viewportUnchanged(atSettle, afterShot) {
  return atSettle.width === afterShot.width && atSettle.height === afterShot.height
}

export function viewportMovedReason(side) {
  return named('the viewport changed during the shot', side)
}

// Which files of `--out` a capture deletes before it writes: the two side PNGs of each row about
// to run, by exact name. Never a prefix match, the sheet or `index.json`.
export function staleFiles(existing, rows) {
  const names = new Set(rows.flatMap((screen) => [`${screen}.design.png`, `${screen}.built.png`]))
  return existing.filter((file) => names.has(file))
}

// Why a step of the shot did not complete: a timeout, or anything else. No error text.
export function shotStepReason(kind, side) {
  return kind === 'timeout' ? named('timed out taking the shot', side) : named('could not take the shot', side)
}
