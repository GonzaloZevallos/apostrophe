// How a design capture takes its shot (GH-338, GH-301). Pure: no Playwright, no DOM, no fs. The browser
// and the files live in `comparisons.mjs` and `census.mjs`, which hand these functions numbers
// and read their answers. Nothing here carries page text: only paths, ordinals, sizes, counts
// and booleans.

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

// What a shot does, decided before anything moves: a layer over the screen is shot as it is, never
// grown; any other page grows the viewport to the document's height, same width (the current height
// when the document already fits).
export function planShot(metrics, fixedElements, viewport) {
  if (coversScreen(fixedElements, viewport)) return { mode: 'layer' }
  return { mode: 'grow', height: grownHeight(metrics, viewport) ?? viewport.height }
}

// The fixed English reasons of a shot that cannot be taken. Each names the side (`design` or
// `built`) and nothing else: no page text, no number, no error text.
const named = (what, side) => `shot: ${what} (${side})`

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
