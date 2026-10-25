// How a design capture takes its shot (GH-338). Pure: no Playwright, no DOM, no fs. The browser
// and the files live in `comparisons.mjs` and `census.mjs`, which hand these functions numbers
// and read their answers. Nothing here carries page text: only paths, ordinals, sizes, counts
// and booleans.

// The height the viewport grows to so a tall page fits it: the document's own, same width.
// Null when the document already fits.
export function grownHeight(metrics, viewport) {
  return metrics.scrollHeight > viewport.height ? metrics.scrollHeight : null
}

// The options of `page.screenshot`. `fullPage` is decided here and only here, and only by the
// page being wider than its viewport: asking for it on a page that fits makes Chromium resize
// the viewport (GH-273). The `clip`, when given, comes first.
export function shotOptions(metrics, clip) {
  const rest = {
    fullPage: metrics.scrollWidth > metrics.innerWidth,
    animations: 'disabled',
    caret: 'initial',
  }
  return clip === undefined ? rest : { clip, ...rest }
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
