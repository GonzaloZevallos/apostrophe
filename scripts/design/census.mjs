// The census of a capture (GH-338): what a row looks like before its viewport grows, and what
// changes when it does. Census mode only (`comparisons.mjs --census`); it measures and never
// decides how a shot is taken (`shot.mjs` does), and it never changes a PNG, a side's failure or the
// exit code: a read that throws leaves only a fixed English `census_error`.
//
// The page is read through `evaluateHandle` only: the elements are held by a handle, never
// attached to `window` or the DOM, and the handle is disposed in a `finally`. Nothing here carries
// page text: only tag-and-class paths, ordinals, counts, sizes, booleans and fixed strings.

import { SETTLE_REASON_REJECTED, SETTLE_REASON_UNSETTLED } from './settle.mjs'
import { censusClass, coversScreen, fitsViewport, grownHeight, sizesChanged } from './shot.mjs'

export const ERROR_BEFORE = 'census read before growth failed'
export const ERROR_AFTER = 'census read after growth failed'
export const ERROR_SETTLE = 'census settle after growth failed'

// Every element of the document, in document order. Held by a handle: nothing is attached to the page.
const allElements = () => [...document.querySelectorAll('*')]

// The size of the document against its window.
const readMetrics = () => ({
  scrollWidth: document.documentElement.scrollWidth,
  scrollHeight: document.documentElement.scrollHeight,
  innerWidth: window.innerWidth,
  innerHeight: window.innerHeight,
})

// The fixed elements, each as the predicate reads it, with its index among all the elements.
// Self-contained: sent to the page.
function fixedInPage(elements) {
  const found = []
  elements.forEach((element, index) => {
    const style = getComputedStyle(element)
    if (style.position !== 'fixed') return
    const rect = element.getBoundingClientRect()
    found.push({
      index,
      display: style.display,
      visibility: style.visibility,
      opacity: Number(style.opacity),
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
    })
  })
  return found
}

// One entry per element, parallel to the handle: its tag-and-class path, its ordinal among the
// elements of that path in document order, its size, and whether it is `.pantalla` or holds one.
// Also the count per path, whether the 900 px query matches, and the inline `--vv-alto`. Self-contained.
function snapshotInPage(elements) {
  const seen = {}
  let vvAlto = null
  const entries = elements.map((element) => {
    const classes = (element.getAttribute('class') ?? '').trim().split(/\s+/).filter(Boolean)
    const path = element.localName + classes.map((name) => `.${name}`).join('')
    const ordinal = seen[path] ?? 0
    seen[path] = ordinal + 1
    const rect = element.getBoundingClientRect()
    if (vvAlto === null) {
      const value = element.style?.getPropertyValue('--vv-alto') ?? ''
      if (value !== '') vvAlto = value
    }
    return {
      path,
      ordinal,
      width: Math.round(rect.width * 100) / 100,
      height: Math.round(rect.height * 100) / 100,
      pantalla: element.classList.contains('pantalla') || element.querySelector('.pantalla') !== null,
    }
  })
  return { entries, counts: seen, query900: window.matchMedia('(min-width: 900px)').matches, vvAlto }
}

// The layer's own box, its inner scroll containers and whether its frame lies inside the viewport.
// `ordinals` are the snapshot's, by index. Self-contained.
function layerInPage([elements, index, ordinals, paths]) {
  const layer = elements[index]
  const rect = layer.getBoundingClientRect()
  const containers = []
  elements.forEach((element, at) => {
    if (!layer.contains(element)) return
    const { overflowY } = getComputedStyle(element)
    if (overflowY !== 'auto' && overflowY !== 'scroll' && overflowY !== 'overlay') return
    containers.push({
      path: paths[at],
      ordinal: ordinals[at],
      client_height: element.clientHeight,
      scroll_height: element.scrollHeight,
      scroll_top: element.scrollTop,
    })
  })
  return {
    overflows: layer.scrollHeight > layer.clientHeight || layer.scrollWidth > layer.clientWidth,
    frame_inside_viewport:
      rect.left >= 0 && rect.top >= 0 && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight,
    scroll_containers: containers,
  }
}

// Which elements before are the very same node after, for the pairs of indexes given. Self-contained.
function sameNodesInPage([before, after, pairs]) {
  return pairs.map(([was, now]) => before[was] === after[now])
}

const settleReason = (reason) =>
  reason === SETTLE_REASON_UNSETTLED ? 'unsettled' : reason === SETTLE_REASON_REJECTED ? 'rejected' : 'other'

const keyOf = (entry) => `${entry.path}\u0000${entry.ordinal}`

// `--vv-alto` between two snapshots: absent on both, unchanged, or changed (with both values).
function vvAltoFlags(before, after) {
  if (before.vvAlto === null && after.vvAlto === null) return { vv_alto: 'absent' }
  const same = before.vvAlto === after.vvAlto
  return { vv_alto: same ? 'unchanged' : 'changed', vv_alto_before: before.vvAlto, vv_alto_after: after.vvAlto }
}

// One side's census. `record` is the plain object that goes into `index.json`; the handle and the
// before snapshot stay here. `settle(page)` is the capture's own settle with no clock advance.
export function createCensus({ deviceScaleFactor, settle }) {
  const record = {}
  let handle = null
  let before = null
  let viewportBefore = null
  const fail = (message) => {
    record.census_error ??= message
  }

  async function readBefore(page) {
    viewportBefore = page.viewportSize()
    record.device_scale_factor = deviceScaleFactor
    record.viewport_before = viewportBefore
    handle = await page.evaluateHandle(allElements)
    const metrics = await page.evaluate(readMetrics)
    const fixed = await page.evaluate(fixedInPage, handle)
    const covering = fixed.find((element) => coversScreen([element], viewportBefore))
    const grown = grownHeight(metrics, viewportBefore) !== null
    const wide = metrics.scrollWidth > metrics.innerWidth
    Object.assign(record, {
      document: {
        scroll_width: metrics.scrollWidth,
        scroll_height: metrics.scrollHeight,
        inner_width: metrics.innerWidth,
        inner_height: metrics.innerHeight,
      },
      layer: covering !== undefined,
      wide,
      grown,
      fits_viewport: fitsViewport(metrics),
      class: censusClass({ layer: covering !== undefined, grown, wide }),
    })
    before = await page.evaluate(snapshotInPage, handle)
    if (covering !== undefined) {
      const ordinals = before.entries.map((entry) => entry.ordinal)
      const paths = before.entries.map((entry) => entry.path)
      record.layer_metrics = await page.evaluate(layerInPage, [handle, covering.index, ordinals, paths])
    }
  }

  // Right before the growth: every value read here is the viewport's own, ungrown. A throw
  // leaves only the fixed message.
  async function readBeforeGrowth(page) {
    try {
      await readBefore(page)
    } catch {
      fail(ERROR_BEFORE)
    }
  }

  // The viewport the shot is taken at, once the growth and the settle are done.
  function atShot(page) {
    record.viewport_shot = page.viewportSize()
  }

  // The sizes that differ, each flagged; `same_node` is checked through the handles of both sides.
  async function changedAfter(page, afterHandle, after) {
    const pairs = []
    const nowOf = new Map(after.entries.map((entry, now) => [keyOf(entry), now]))
    before.entries.forEach((entry, was) => {
      const now = nowOf.get(keyOf(entry))
      if (now !== undefined) pairs.push([was, now])
    })
    const same = await page.evaluate(sameNodesInPage, [handle, afterHandle, pairs])
    pairs.forEach(([was], at) => {
      before.entries[was].same_node = same[at]
    })
    const width900 = viewportBefore.width === page.viewportSize().width ? 'n/a' : before.query900 !== after.query900
    const vv = vvAltoFlags(before, after)
    record.sizes_changed = sizesChanged(before, after).map((change) =>
      change.kind === 'count' ? change : { ...change, query_900: width900, ...vv },
    )
  }

  // After the real shot and `verifyAfterShot`, on the same page: the viewport grows to the
  // document's height, the page settles (no clock advance), and the sizes are compared. The page is
  // discarded afterwards; nothing is shot after the growth.
  async function readAfter(page) {
    if (before === null) return
    const metrics = await page.evaluate(readMetrics)
    const height = grownHeight(metrics, page.viewportSize())
    if (height !== null) await page.setViewportSize({ width: page.viewportSize().width, height })
    const reason = await settle(page)
    if (reason) {
      fail(ERROR_SETTLE)
      record.census_settle = settleReason(reason)
      return
    }
    record.viewport_after = page.viewportSize()
    record.fits_viewport_after = fitsViewport(await page.evaluate(readMetrics))
    const afterHandle = await page.evaluateHandle(allElements)
    try {
      await changedAfter(page, afterHandle, await page.evaluate(snapshotInPage, afterHandle))
    } finally {
      await afterHandle.dispose()
    }
  }

  async function readAfterGrowth(page) {
    try {
      await readAfter(page)
    } catch {
      fail(ERROR_AFTER)
    } finally {
      await dispose()
    }
  }

  async function dispose() {
    const held = handle
    handle = null
    try {
      await held?.dispose()
    } catch {
      // The page is gone already: nothing is left to release.
    }
  }

  return { record, before: readBeforeGrowth, atShot, after: readAfterGrowth, dispose }
}
