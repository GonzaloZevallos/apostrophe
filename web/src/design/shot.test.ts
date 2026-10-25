import { describe, expect, it } from 'vitest'
import {
  censusClass,
  coversScreen,
  fitsViewport,
  grownHeight,
  shotOptions,
  sizesChanged,
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

describe('shotOptions', () => {
  const SHOT = { animations: 'disabled', caret: 'initial' }

  it('asks for a plain shot of a page that fits its width', () => {
    expect(shotOptions({ scrollWidth: 390, innerWidth: 390 })).toStrictEqual({ fullPage: false, ...SHOT })
  })

  it('asks for fullPage only for a page wider than its viewport', () => {
    expect(shotOptions({ scrollWidth: 1200, innerWidth: 390 })).toStrictEqual({ fullPage: true, ...SHOT })
  })

  it('puts the clip first for a section and keeps the same rule', () => {
    const clip = { x: 0, y: 10, width: 100, height: 50 }
    const options = shotOptions({ scrollWidth: 390, innerWidth: 390 }, clip)
    expect(options).toStrictEqual({ clip, fullPage: false, ...SHOT })
    expect(Object.keys(options)[0]).toBe('clip')
    expect(shotOptions({ scrollWidth: 400, innerWidth: 390 }, clip)).toStrictEqual({
      clip,
      fullPage: true,
      ...SHOT,
    })
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
