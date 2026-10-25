import { describe, expect, it } from 'vitest'
import {
  censusClass,
  coversScreen,
  fitsViewport,
  grownHeight,
  layerMiss,
  planShot,
  regionMiss,
  shotStepReason,
  sizeRecordMiss,
  sizesChanged,
  staleFiles,
  viewportMovedReason,
  viewportUnchanged,
  type FixedElement,
  type Snapshot,
} from '../../../scripts/design/shot.mjs'

const PHONE = { width: 390, height: 844 }

const fixed = (rect: FixedElement['rect'], over: Partial<FixedElement> = {}): FixedElement => ({
  display: 'block',
  visibility: 'visible',
  opacity: 1,
  rect,
  ...over,
})

describe('grownHeight', () => {
  it('is null when the document fits its viewport', () => {
    expect(grownHeight({ scrollHeight: 844 }, PHONE)).toBeNull()
    expect(grownHeight({ scrollHeight: 300 }, PHONE)).toBeNull()
  })

  it('is the height of the document when it is taller', () => {
    expect(grownHeight({ scrollHeight: 2000 }, PHONE)).toBe(2000)
  })
})

describe('coversScreen', () => {
  it('counts an open inset-0 layer', () => {
    expect(coversScreen([fixed({ left: 0, top: 0, right: 390, bottom: 844 })], PHONE)).toBe(true)
  })

  it('counts a phone sheet that starts just under the top', () => {
    expect(coversScreen([fixed({ left: 0, top: 48, right: 390, bottom: 844 })], PHONE)).toBe(true)
  })

  it('counts an intersection of exactly half the height', () => {
    expect(coversScreen([fixed({ left: 0, top: 422, right: 390, bottom: 844 })], PHONE)).toBe(true)
  })

  it('counts a layer wider than the viewport', () => {
    expect(coversScreen([fixed({ left: -20, top: 0, right: 500, bottom: 900 })], PHONE)).toBe(true)
  })

  it('counts any one element among several', () => {
    const bar = fixed({ left: 0, top: 784, right: 390, bottom: 844 })
    const layer = fixed({ left: 0, top: 0, right: 390, bottom: 844 })
    expect(coversScreen([bar, layer], PHONE)).toBe(true)
  })

  it('ignores a sheet parked 100% below the viewport', () => {
    expect(coversScreen([fixed({ left: 0, top: 844, right: 390, bottom: 1688 })], PHONE)).toBe(false)
  })

  it('ignores display:none, visibility:hidden and opacity:0', () => {
    const rect = { left: 0, top: 0, right: 390, bottom: 844 }
    expect(coversScreen([fixed(rect, { display: 'none' })], PHONE)).toBe(false)
    expect(coversScreen([fixed(rect, { visibility: 'hidden' })], PHONE)).toBe(false)
    expect(coversScreen([fixed(rect, { opacity: 0 })], PHONE)).toBe(false)
  })

  it('ignores a 60 px bar and a toast', () => {
    expect(coversScreen([fixed({ left: 0, top: 784, right: 390, bottom: 844 })], PHONE)).toBe(false)
    expect(coversScreen([fixed({ left: 40, top: 700, right: 350, bottom: 760 })], PHONE)).toBe(false)
  })

  it('ignores an intersection 1 px under half the height', () => {
    expect(coversScreen([fixed({ left: 0, top: 423, right: 390, bottom: 844 })], PHONE)).toBe(false)
  })

  it('ignores an intersection 1 px short of the full width', () => {
    expect(coversScreen([fixed({ left: 1, top: 0, right: 390, bottom: 844 })], PHONE)).toBe(false)
    expect(coversScreen([fixed({ left: 0, top: 0, right: 389, bottom: 844 })], PHONE)).toBe(false)
  })

  it('clips the rect to the viewport on every side before measuring it', () => {
    // Raw size would pass on each of these; only the part inside the viewport counts.
    expect(coversScreen([fixed({ left: -300, top: 0, right: 200, bottom: 844 })], PHONE)).toBe(false)
    expect(coversScreen([fixed({ left: 100, top: 0, right: 600, bottom: 844 })], PHONE)).toBe(false)
    expect(coversScreen([fixed({ left: 0, top: -500, right: 390, bottom: 300 })], PHONE)).toBe(false)
    expect(coversScreen([fixed({ left: 0, top: 700, right: 390, bottom: 1700 })], PHONE)).toBe(false)
  })

  it('is false with no fixed elements', () => {
    expect(coversScreen([], PHONE)).toBe(false)
  })
})

const snap = (
  entries: Array<[string, number, number, number]>,
  counts: Record<string, number>,
): Snapshot => ({
  entries: entries.map(([path, ordinal, width, height]) => ({ path, ordinal, width, height })),
  counts,
})

describe('sizesChanged', () => {
  it('matches repeated paths by ordinal', () => {
    const before = snap([['div.a', 0, 10, 10], ['div.a', 1, 10, 10]], { 'div.a': 2 })
    const after = snap([['div.a', 0, 10, 10], ['div.a', 1, 10, 30]], { 'div.a': 2 })
    expect(sizesChanged(before, after)).toStrictEqual([
      {
        path: 'div.a',
        ordinal: 1,
        before: { width: 10, height: 10 },
        after: { width: 10, height: 30 },
      },
    ])
  })

  it('returns nothing when no size changed', () => {
    const s = snap([['div.a', 0, 10, 10]], { 'div.a': 1 })
    expect(sizesChanged(s, s)).toStrictEqual([])
  })

  it('never lets a flag overwrite the path, ordinal, before, after or kind of an entry', () => {
    const before: Snapshot = {
      entries: [{ path: 'div.a', ordinal: 0, width: 1, height: 1, before: true, after: 'x', kind: 'y' }],
      counts: { 'div.a': 1 },
    }
    const after: Snapshot = {
      entries: [{ path: 'div.a', ordinal: 0, width: 1, height: 2 }],
      counts: { 'div.a': 1 },
    }
    expect(sizesChanged(before, after)).toStrictEqual([
      { path: 'div.a', ordinal: 0, before: { width: 1, height: 1 }, after: { width: 1, height: 2 } },
    ])
  })

  it('carries the flags of the entry through', () => {
    const before: Snapshot = {
      entries: [{ path: 'div.pantalla', ordinal: 0, width: 1, height: 1, pantalla: true }],
      counts: { 'div.pantalla': 1 },
    }
    const after: Snapshot = {
      entries: [{ path: 'div.pantalla', ordinal: 0, width: 1, height: 2, pantalla: true }],
      counts: { 'div.pantalla': 1 },
    }
    expect(sizesChanged(before, after)).toStrictEqual([
      {
        path: 'div.pantalla',
        ordinal: 0,
        before: { width: 1, height: 1 },
        after: { width: 1, height: 2 },
        pantalla: true,
      },
    ])
  })

  it('records a count entry when a path count changes, and the unmatched entry with null', () => {
    const before = snap([['li.x', 0, 5, 5]], { 'li.x': 1 })
    const after = snap([['li.x', 0, 5, 5], ['li.x', 1, 5, 5]], { 'li.x': 2 })
    expect(sizesChanged(before, after)).toStrictEqual([
      { path: 'li.x', ordinal: 1, before: null, after: { width: 5, height: 5 } },
      { path: 'li.x', kind: 'count', before: 1, after: 2 },
    ])
  })

  it('records a path that vanished, with null on the after side', () => {
    const before = snap([['p.gone', 0, 5, 5]], { 'p.gone': 1 })
    const after = snap([], {})
    expect(sizesChanged(before, after)).toStrictEqual([
      { path: 'p.gone', ordinal: 0, before: { width: 5, height: 5 }, after: null },
      { path: 'p.gone', kind: 'count', before: 1, after: 0 },
    ])
  })
})

describe('fitsViewport', () => {
  it('gives a fixed reason for a page wider than its viewport', () => {
    expect(
      fitsViewport({ scrollWidth: 1200, innerWidth: 390, scrollHeight: 800, innerHeight: 844 }),
    ).toBe('page wider than its viewport')
  })

  it('gives a fixed reason for a page still taller than its viewport', () => {
    expect(
      fitsViewport({ scrollWidth: 390, innerWidth: 390, scrollHeight: 2000, innerHeight: 844 }),
    ).toBe('page taller than its viewport')
  })

  it('is null for a page that fits', () => {
    expect(
      fitsViewport({ scrollWidth: 390, innerWidth: 390, scrollHeight: 844, innerHeight: 844 }),
    ).toBeNull()
  })
})

describe('censusClass', () => {
  it('gives one class per step', () => {
    expect(censusClass({ layer: true, grown: false, wide: false })).toBe('layer')
    expect(censusClass({ layer: false, grown: true, wide: false })).toBe('grown')
    expect(censusClass({ layer: false, grown: false, wide: true })).toBe('wide')
    expect(censusClass({ layer: false, grown: false, wide: false })).toBe('neither')
  })

  it('resolves overlaps by layer > grown > wide', () => {
    expect(censusClass({ layer: true, grown: true, wide: true })).toBe('layer')
    expect(censusClass({ layer: true, grown: false, wide: true })).toBe('layer')
    expect(censusClass({ layer: false, grown: true, wide: true })).toBe('grown')
  })
})

describe('planShot', () => {
  const metrics = { scrollWidth: 390, scrollHeight: 1699, innerWidth: 390, innerHeight: 844 }
  const layer = fixed({ left: 0, top: 0, right: 390, bottom: 844 })
  const bar = fixed({ left: 0, top: 784, right: 390, bottom: 844 })

  it('is a layer, never grown, when a fixed element covers the screen', () => {
    expect(planShot(metrics, [bar, layer], PHONE)).toStrictEqual({ mode: 'layer' })
  })

  it('grows to the height of the document otherwise, a bar included', () => {
    expect(planShot(metrics, [bar], PHONE)).toStrictEqual({ mode: 'grow', height: 1699 })
    expect(planShot(metrics, [], PHONE)).toStrictEqual({ mode: 'grow', height: 1699 })
  })

  it('keeps the current height when the page already fits', () => {
    expect(planShot({ ...metrics, scrollHeight: 300 }, [], PHONE)).toStrictEqual({ mode: 'grow', height: 844 })
  })
})

describe('layerMiss', () => {
  const inside = { left: 0, top: 0, right: 390, bottom: 844 }
  const container = (scrollTop: number) => ({ scrollTop })
  const SIDE_REASON = /\((design|built)\)$/

  it('passes a frame inside the viewport with nothing scrolled', () => {
    expect(layerMiss(inside, PHONE, [], 'built')).toBeNull()
    expect(layerMiss({ left: 0, top: 48, right: 390, bottom: 844 }, PHONE, [], 'design')).toBeNull()
  })

  it('misses a frame past the bottom, the right, the left or the top', () => {
    const bottom = layerMiss({ ...inside, bottom: 845 }, PHONE, [], 'built')
    expect(bottom).toBe('shot: layer frame outside the viewport (built)')
    expect(layerMiss({ ...inside, right: 391 }, PHONE, [], 'design')).toBe('shot: layer frame outside the viewport (design)')
    expect(layerMiss({ ...inside, left: -1 }, PHONE, [], 'built')).toMatch(/frame outside/)
    expect(layerMiss({ ...inside, top: -1 }, PHONE, [], 'built')).toMatch(/frame outside/)
  })

  it('passes a list at its top, whether or not it overflows', () => {
    expect(layerMiss(inside, PHONE, [container(0), container(0)], 'built')).toBeNull()
  })

  it('misses any element of the layer that is scrolled, whatever its overflow', () => {
    const reason = layerMiss(inside, PHONE, [container(0), container(12)], 'built')
    expect(reason).toBe("shot: a layer's content is scrolled (built)")
    expect(reason).toMatch(SIDE_REASON)
  })
})

describe('regionMiss', () => {
  const fits = { scrollWidth: 390, scrollHeight: 844, innerWidth: 390, innerHeight: 844 }

  it('passes a document that fits the viewport in both axes', () => {
    expect(regionMiss(fits, undefined, 'built')).toBeNull()
  })

  it('misses a page wider than its viewport, on either side', () => {
    expect(regionMiss({ ...fits, scrollWidth: 414 }, undefined, 'built')).toBe('shot: page wider than its viewport (built)')
    expect(regionMiss({ ...fits, scrollWidth: 414 }, undefined, 'design')).toBe('shot: page wider than its viewport (design)')
  })

  it('misses a page still taller than its viewport', () => {
    expect(regionMiss({ ...fits, scrollHeight: 2000 }, undefined, 'built')).toBe('shot: page taller than its viewport (built)')
  })

  it('passes a clip inside the viewport, however wide the document is', () => {
    const clip = { x: 10, y: 20, width: 370, height: 800 }
    expect(regionMiss({ ...fits, scrollWidth: 414 }, clip, 'design')).toBeNull()
  })

  it('does not look at the document behind a layer, which may scroll, but still checks a clip', () => {
    const behind = { ...fits, scrollWidth: 414, scrollHeight: 1059 }
    expect(regionMiss(behind, undefined, 'built', { layer: true })).toBeNull()
    expect(regionMiss(behind, undefined, 'built', { layer: false })).toMatch(/wider/)
    expect(regionMiss(behind, { x: 0, y: 0, width: 500, height: 10 }, 'design', { layer: true })).toMatch(/section outside/)
  })

  it('misses a clip that leaves the viewport', () => {
    expect(regionMiss(fits, { x: 0, y: 0, width: 391, height: 100 }, 'design')).toBe('shot: section outside the viewport (design)')
    expect(regionMiss(fits, { x: 0, y: 800, width: 100, height: 100 }, 'design')).toMatch(/section outside/)
    expect(regionMiss(fits, { x: -1, y: 0, width: 100, height: 100 }, 'design')).toMatch(/section outside/)
  })
})

describe('sizeRecordMiss', () => {
  type Rec = { path: string; ordinal: number; top: number; width: number; height: number; pinned: boolean; same_node?: boolean }
  const rec = (path: string, ordinal: number, top: number, width: number, height: number, over: Partial<Rec> = {}): Rec => ({
    path,
    ordinal,
    top,
    width,
    height,
    pinned: false,
    same_node: true,
    ...over,
  })
  const state = (entries: Rec[]): Snapshot => {
    const counts: Record<string, number> = {}
    for (const entry of entries) counts[entry.path] = (counts[entry.path] ?? 0) + 1
    return { entries, counts }
  }
  const REASON = 'shot: the page changed when the viewport grew (built)'

  it('passes growth with every top where it was', () => {
    const before = state([rec('div.a', 0, 0, 390, 844), rec('div.b', 0, 100, 300, 50)])
    const after = state([rec('div.a', 0, 0, 390, 1699), rec('div.b', 0, 100, 300, 50)])
    expect(sizeRecordMiss(before, after, 'built')).toBeNull()
  })

  it('misses a child whose top moves', () => {
    const before = state([rec('div.a', 0, 100, 300, 50)])
    const after = state([rec('div.a', 0, 220, 300, 50)])
    expect(sizeRecordMiss(before, after, 'built')).toBe(REASON)
  })

  it('lets a pinned bar move its top, and nothing else', () => {
    const before = state([rec('nav.bar', 0, 784, 390, 60, { pinned: true })])
    expect(sizeRecordMiss(before, state([rec('nav.bar', 0, 1639, 390, 60, { pinned: true })]), 'built')).toBeNull()
    expect(sizeRecordMiss(before, state([rec('nav.bar', 0, 1639, 400, 60, { pinned: true })]), 'built')).toBe(REASON)
    expect(sizeRecordMiss(before, state([rec('nav.bar', 0, 1639, 390, 40, { pinned: true })]), 'built')).toBe(REASON)
  })

  it('misses a width change and a height shrink', () => {
    const before = state([rec('div.a', 0, 0, 300, 50)])
    expect(sizeRecordMiss(before, state([rec('div.a', 0, 0, 320, 50)]), 'built')).toBe(REASON)
    expect(sizeRecordMiss(before, state([rec('div.a', 0, 0, 300, 49)]), 'built')).toBe(REASON)
  })

  it('misses a replaced node', () => {
    const before = state([rec('div.a', 0, 0, 300, 50)])
    const after = state([rec('div.a', 0, 0, 300, 50, { same_node: false })])
    expect(sizeRecordMiss(before, after, 'design')).toBe('shot: the page changed when the viewport grew (design)')
  })

  it('misses a count change, an element gained or lost', () => {
    const before = state([rec('li.x', 0, 0, 5, 5)])
    expect(sizeRecordMiss(before, state([rec('li.x', 0, 0, 5, 5), rec('li.x', 1, 5, 5, 5)]), 'built')).toBe(REASON)
    expect(sizeRecordMiss(before, state([]), 'built')).toBe(REASON)
  })

  it('misses an element that grows while the document stays taller than the viewport, through regionMiss', () => {
    const before = state([rec('div.a', 0, 0, 390, 844)])
    const after = state([rec('div.a', 0, 0, 390, 1200)])
    expect(sizeRecordMiss(before, after, 'built')).toBeNull()
    const stuck = { scrollWidth: 390, scrollHeight: 2000, innerWidth: 390, innerHeight: 1200 }
    expect(regionMiss(stuck, undefined, 'built')).toBe('shot: page taller than its viewport (built)')
  })

  it('carries no page text or number in its reason', () => {
    const before = state([rec('div.secret-name', 0, 100, 300, 50)])
    const after = state([rec('div.secret-name', 0, 999, 300, 50)])
    expect(sizeRecordMiss(before, after, 'built')).not.toMatch(/secret|\d/)
  })
})

describe('viewportUnchanged', () => {
  it('is true for the same size and false for any other', () => {
    expect(viewportUnchanged({ width: 390, height: 1699 }, { width: 390, height: 1699 })).toBe(true)
    expect(viewportUnchanged({ width: 390, height: 1699 }, { width: 1, height: 1 })).toBe(false)
    expect(viewportUnchanged({ width: 390, height: 1699 }, { width: 390, height: 844 })).toBe(false)
    expect(viewportUnchanged({ width: 390, height: 1699 }, { width: 400, height: 1699 })).toBe(false)
  })

  it('has a fixed English reason naming only the side', () => {
    expect(viewportMovedReason('design')).toBe('shot: the viewport changed during the shot (design)')
    expect(viewportMovedReason('built')).toBe('shot: the viewport changed during the shot (built)')
  })
})

describe('staleFiles', () => {
  const listing = [
    'Inicio.png',
    'Inicio.design.png',
    'Inicio.built.png',
    'InicioCompu.design.png',
    'InicioCompu.built.png',
    'Ajustes.built.png',
    'index.json',
    'notes.txt',
  ]

  it("returns exactly the row's two side PNGs", () => {
    expect(staleFiles(listing, ['Inicio']).sort()).toStrictEqual(['Inicio.built.png', 'Inicio.design.png'])
  })

  it('leaves another row, the sheet, index.json and a longer row name alone', () => {
    const stale = staleFiles(listing, ['Inicio'])
    expect(stale).not.toContain('InicioCompu.built.png')
    expect(stale).not.toContain('Inicio.png')
    expect(stale).not.toContain('index.json')
    expect(stale).not.toContain('Ajustes.built.png')
  })

  it('returns only what is present, for every row about to run', () => {
    expect(staleFiles(listing, ['InicioCompu', 'Ajustes', 'Gastos']).sort()).toStrictEqual([
      'Ajustes.built.png',
      'InicioCompu.built.png',
      'InicioCompu.design.png',
    ])
    expect(staleFiles([], ['Inicio'])).toStrictEqual([])
  })
})

describe('shotStepReason', () => {
  it('names a timeout and the side', () => {
    expect(shotStepReason('timeout', 'design')).toBe('shot: timed out taking the shot (design)')
    expect(shotStepReason('timeout', 'built')).toBe('shot: timed out taking the shot (built)')
  })

  it('gives one reason for any other kind', () => {
    expect(shotStepReason('error', 'design')).toBe('shot: could not take the shot (design)')
    expect(shotStepReason('whatever', 'built')).toBe('shot: could not take the shot (built)')
  })
})
