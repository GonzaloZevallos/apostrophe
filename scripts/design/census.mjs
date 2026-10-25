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
import { allElements, fixedInPage, layerInPage, readMetrics, sameNodesInPage, snapshotInPage } from './shot-page.mjs'

export const ERROR_BEFORE = 'census read before growth failed'
export const ERROR_AFTER = 'census read after growth failed'
export const ERROR_SETTLE = 'census settle after growth failed'

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
      const ordinals = []
      const paths = []
      for (const entry of before.entries) {
        ordinals[entry.index] = entry.ordinal
        paths[entry.index] = entry.path
      }
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
    const same = await page.evaluate(sameNodesInPage, [
      handle,
      afterHandle,
      pairs.map(([was, now]) => [before.entries[was].index, after.entries[now].index]),
    ])
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
