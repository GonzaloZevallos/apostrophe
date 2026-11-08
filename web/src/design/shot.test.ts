import { describe, expect, it } from 'vitest'
import {
  CALM_CONTEXT,
  CALM_CSS,
  PROBE_CSS,
  captureContextOptions,
  censusClass,
  coversScreen,
  fitsViewport,
  grownHeight,
  hiddenRule,
  innerScrollMiss,
  layerMiss,
  named,
  pinnedClass,
  planShot,
  regionMiss,
  rowCapture,
  scrollPlan,
  shiftMiss,
  shotReason,
  shotStepReason,
  sizeRecordMiss,
  sizesChanged,
  staleFiles,
  stickyPlacement,
  stickyProbeOffset,
  viewportFixed,
  viewportMovedReason,
  viewportUnchanged,
  type FixedElement,
  type FrameRead,
  type Pinned,
  type Snapshot,
} from '../../../scripts/design/shot.mjs'
import { SETTLE_REASON_REJECTED, SETTLE_REASON_UNSETTLED } from '../../../scripts/design/settle.mjs'

const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 800 }

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
    expect(planShot(metrics, [bar], DESKTOP)).toStrictEqual({ mode: 'grow', height: 1699 })
    expect(planShot(metrics, [], DESKTOP)).toStrictEqual({ mode: 'grow', height: 1699 })
  })

  it('keeps the current height when the page already fits', () => {
    expect(planShot({ ...metrics, scrollHeight: 300 }, [], DESKTOP)).toStrictEqual({ mode: 'grow', height: 800 })
  })

  it('grows at 1280 and at the first width that is not a phone', () => {
    expect(planShot(metrics, [], { width: 1280, height: 800 })).toStrictEqual({ mode: 'grow', height: 1699 })
    expect(planShot(metrics, [], { width: 900, height: 800 })).toStrictEqual({ mode: 'grow', height: 1699 })
  })

  it.each([
    [320, 568],
    [375, 812],
    [390, 844],
    [430, 932],
    [899, 800],
  ])('scrolls a page at %i px wide, bar included', (width, height) => {
    expect(planShot(metrics, [bar], { width, height })).toStrictEqual({ mode: 'scroll' })
    expect(planShot({ ...metrics, scrollHeight: 300 }, [], { width, height })).toStrictEqual({ mode: 'scroll' })
  })

  it('is a layer on a phone too: a sheet is one viewport and never stitched', () => {
    expect(planShot(metrics, [bar, layer], PHONE)).toStrictEqual({ mode: 'layer' })
  })
})

const pinned = (over: Partial<Pinned> = {}): Pinned => ({
  chain: 'body > :nth-child(1)',
  position: 'fixed',
  insetTop: 'auto',
  insetBottom: 0,
  marginTop: 0,
  marginBottom: 0,
  transform: 'none',
  rect: { left: 0, top: 784, right: 390, bottom: 844 },
  container: { contentTop: 0, contentBottom: 2000 },
  ...over,
})

describe('pinnedClass', () => {
  it('reads only the own position: fixed is chrome, sticky is content', () => {
    expect(pinnedClass(pinned({ position: 'fixed' }))).toBe('chrome')
    expect(pinnedClass(pinned({ position: 'sticky' }))).toBe('content')
  })

  it('does not look at the chain, the insets or the container', () => {
    expect(pinnedClass(pinned({ position: 'sticky', chain: 'body > :nth-child(9)', insetBottom: 'auto', insetTop: 0 }))).toBe(
      'content',
    )
    expect(pinnedClass(pinned({ position: 'fixed', container: { contentTop: 5, contentBottom: 6 } }))).toBe('chrome')
  })

  it('refuses a position that is not pinned', () => {
    expect(() => pinnedClass(pinned({ position: 'absolute' as 'fixed' }))).toThrow('shot: not a pinned position')
  })
})

describe('viewportFixed', () => {
  it('holds on the bottom equation: rect.bottom = height - inset - margin', () => {
    expect(viewportFixed(pinned({ insetBottom: 0 }), PHONE)).toBe(true)
    const newSale = pinned({ insetBottom: 96, marginBottom: 4, rect: { left: 300, top: 700, right: 380, bottom: 744 } })
    expect(viewportFixed(newSale, PHONE)).toBe(true)
  })

  it('holds on the top equation: rect.top = inset + margin', () => {
    const top = pinned({ insetTop: 12, insetBottom: 'auto', marginTop: 2, rect: { left: 0, top: 14, right: 390, bottom: 70 } })
    expect(viewportFixed(top, PHONE)).toBe(true)
  })

  it('compares within half a CSS px, no more', () => {
    const near = pinned({ rect: { left: 0, top: 784, right: 390, bottom: 843.5 } })
    const far = pinned({ rect: { left: 0, top: 784, right: 390, bottom: 843.4 } })
    expect(viewportFixed(near, PHONE)).toBe(true)
    expect(viewportFixed(far, PHONE)).toBe(false)
  })

  it('does not hold with both insets auto', () => {
    expect(viewportFixed(pinned({ insetTop: 'auto', insetBottom: 'auto' }), PHONE)).toBe(false)
  })

  it('does not hold when a transformed ancestor moves the element off its insets', () => {
    expect(viewportFixed(pinned({ rect: { left: 0, top: 1584, right: 390, bottom: 1644 } }), PHONE)).toBe(false)
  })

  it('does not hold with an auto margin it cannot place', () => {
    expect(viewportFixed(pinned({ marginBottom: 'auto' }), PHONE)).toBe(false)
  })
})

describe('scrollPlan', () => {
  const doc = (scrollHeight: number) => ({ scrollHeight, innerWidth: 390, innerHeight: 844 })

  it('refuses a device scale factor that is not a whole number, naming the side', () => {
    expect(scrollPlan(doc(2000), PHONE, 1.5, undefined, [], 'built')).toStrictEqual({
      reason: 'shot: device scale factor is not a whole number (built)',
    })
    expect(scrollPlan(doc(2000), PHONE, 2.5, undefined, [], 'design')).toStrictEqual({
      reason: 'shot: device scale factor is not a whole number (design)',
    })
  })

  it('steps by the viewport height from 0 and clamps the last offset, cropping its overlap (dpr 1)', () => {
    expect(scrollPlan(doc(2000), PHONE, 1, undefined, [], 'built')).toStrictEqual({
      frames: [
        { offset: 0, cropTop: 0, cropHeight: 844 },
        { offset: 844, cropTop: 0, cropHeight: 844 },
        { offset: 1156, cropTop: 532, cropHeight: 312 },
      ],
    })
  })

  it('crops in device px and offsets in CSS px (dpr 2 and 3)', () => {
    expect(scrollPlan(doc(2000), PHONE, 2, undefined, [], 'built')).toStrictEqual({
      frames: [
        { offset: 0, cropTop: 0, cropHeight: 1688 },
        { offset: 844, cropTop: 0, cropHeight: 1688 },
        { offset: 1156, cropTop: 1064, cropHeight: 624 },
      ],
    })
    expect(scrollPlan(doc(2000), PHONE, 3, undefined, [], 'built')).toStrictEqual({
      frames: [
        { offset: 0, cropTop: 0, cropHeight: 2532 },
        { offset: 844, cropTop: 0, cropHeight: 2532 },
        { offset: 1156, cropTop: 1596, cropHeight: 936 },
      ],
    })
  })

  it('has no clamped overlap when the document is a whole number of viewports', () => {
    expect(scrollPlan(doc(1688), PHONE, 2, undefined, [], 'built')).toStrictEqual({
      frames: [
        { offset: 0, cropTop: 0, cropHeight: 1688 },
        { offset: 844, cropTop: 0, cropHeight: 1688 },
      ],
    })
  })

  it('is one whole-viewport frame for a page that fits', () => {
    expect(scrollPlan(doc(300), PHONE, 2, undefined, [], 'built')).toStrictEqual({
      frames: [{ offset: 0, cropTop: 0, cropHeight: 1688 }],
    })
    expect(scrollPlan(doc(844), PHONE, 1, undefined, [], 'built')).toStrictEqual({
      frames: [{ offset: 0, cropTop: 0, cropHeight: 844 }],
    })
  })

  it('breaks a frame at a sticky boundary inside its step, rounded down to a whole CSS px', () => {
    expect(scrollPlan(doc(2000), PHONE, 1, undefined, [500.4], 'built')).toStrictEqual({
      frames: [
        { offset: 0, cropTop: 0, cropHeight: 500 },
        { offset: 500, cropTop: 0, cropHeight: 844 },
        { offset: 1156, cropTop: 188, cropHeight: 656 },
      ],
    })
  })

  it('ignores a boundary at a frame start, at its end, or outside the document', () => {
    const plain = scrollPlan(doc(2000), PHONE, 1, undefined, [], 'built')
    expect(scrollPlan(doc(2000), PHONE, 1, undefined, [0, 844, 2000, 5000, -3], 'built')).toStrictEqual(plain)
  })

  it('covers a clip from its y, cropping to it (dpr 1 and 2)', () => {
    const clip = { x: 0, y: 900.5, width: 390, height: 300 }
    expect(scrollPlan(doc(2000), PHONE, 1, clip, [], 'built')).toStrictEqual({
      frames: [{ offset: 900, cropTop: 0, cropHeight: 301 }],
    })
    expect(scrollPlan(doc(2000), PHONE, 2, clip, [], 'built')).toStrictEqual({
      frames: [{ offset: 900, cropTop: 0, cropHeight: 601 }],
    })
  })

  it('steps over a tall clip and crops the overlap of the last frame', () => {
    expect(scrollPlan(doc(2000), PHONE, 1, { x: 0, y: 700, width: 390, height: 1300 }, [], 'built')).toStrictEqual({
      frames: [
        { offset: 700, cropTop: 0, cropHeight: 844 },
        { offset: 1156, cropTop: 388, cropHeight: 456 },
      ],
    })
  })

  it('refuses a clip wider than the viewport or past the document, as a section outside it', () => {
    const outside = { reason: 'shot: section outside the viewport (design)' }
    expect(scrollPlan(doc(2000), PHONE, 1, { x: 0, y: 10, width: 400, height: 50 }, [], 'design')).toStrictEqual(outside)
    expect(scrollPlan(doc(2000), PHONE, 1, { x: -1, y: 10, width: 50, height: 50 }, [], 'design')).toStrictEqual(outside)
    expect(scrollPlan(doc(2000), PHONE, 1, { x: 0, y: 1990, width: 50, height: 50 }, [], 'design')).toStrictEqual(outside)
    expect(scrollPlan(doc(2000), PHONE, 1, { x: 0, y: -4, width: 50, height: 50 }, [], 'design')).toStrictEqual(outside)
  })
})

describe('stickyPlacement', () => {
  const REFUSED = { reason: 'shot: a pinned element could not be placed (built)' }
  const metrics = { scrollHeight: 2000, innerWidth: 390, innerHeight: 844 }
  const plan = (boundaries: number[] = []) => {
    const planned = scrollPlan(metrics, PHONE, 1, undefined, boundaries, 'built')
    if (!('frames' in planned)) throw new Error('fixture plan refused')
    return planned.frames
  }
  const bar = pinned({ chain: 'body > :nth-child(2)' })
  const newSale = pinned({
    chain: 'body > :nth-child(3)',
    insetBottom: 96,
    marginBottom: 4,
    rect: { left: 300, top: 700, right: 380, bottom: 744 },
  })
  const sticky = (top: number, bottom: number, over: Partial<Pinned> = {}): Pinned =>
    pinned({
      chain: 'body > :nth-child(1) > :nth-child(4)',
      position: 'sticky',
      insetBottom: 0,
      rect: { left: 0, top: 784, right: 390, bottom: 844 },
      natural: { top, bottom },
      ...over,
    })
  const place = (elements: Pinned[], frames = plan(), dpr = 1) => stickyPlacement(elements, frames, PHONE, 'built', dpr)

  it('puts chrome on frame 0: a bottom bar and "+ New sale" with a calc-ed bottom, Home-like', () => {
    expect(place([bar, newSale])).toStrictEqual({
      units: [
        { chain: 'body > :nth-child(2)', position: 'fixed' },
        { chain: 'body > :nth-child(3)', position: 'fixed' },
      ],
      assignment: [0, 0],
    })
  })

  it('places content on the frame whose crop holds its natural rect whole', () => {
    const result = place([bar, sticky(300, 360), sticky(1000, 1060, { chain: 'body > :nth-child(9)' })])
    expect(result).toMatchObject({ assignment: [0, 0, 1] })
  })

  it('places three chrome elements, one nested in another, and a sticky element: nested is part of its unit', () => {
    const nested = pinned({ chain: 'body > :nth-child(2) > :nth-child(1)' })
    const result = place([bar, nested, newSale, sticky(1000, 1060)])
    expect(result).toStrictEqual({
      units: [
        { chain: 'body > :nth-child(2)', position: 'fixed' },
        { chain: 'body > :nth-child(3)', position: 'fixed' },
        { chain: 'body > :nth-child(1) > :nth-child(4)', position: 'sticky' },
      ],
      assignment: [0, 0, 1],
    })
  })

  it('keeps a sticky element nested in a sticky one in the outer unit', () => {
    const inner = sticky(1010, 1040, { chain: 'body > :nth-child(1) > :nth-child(4) > :nth-child(1)' })
    const result = place([sticky(1000, 1060), inner])
    expect(result).toMatchObject({ assignment: [1] })
  })

  it('places a fixed element inside a sticky one as chrome on frame 0, the sticky one on its own frame', () => {
    const inside = pinned({ chain: 'body > :nth-child(1) > :nth-child(4) > :nth-child(1)' })
    const result = place([sticky(1000, 1060), inside])
    expect(result).toStrictEqual({
      units: [
        { chain: 'body > :nth-child(1) > :nth-child(4)', position: 'sticky' },
        { chain: 'body > :nth-child(1) > :nth-child(4) > :nth-child(1)', position: 'fixed' },
      ],
      assignment: [1, 0],
    })
  })

  it('uses the device scale factor of the shot to read the crops (dpr 2 by default)', () => {
    const planned = scrollPlan(metrics, PHONE, 2, undefined, [], 'built')
    if (!('frames' in planned)) throw new Error('fixture plan refused')
    expect(stickyPlacement([bar, sticky(1000, 1060)], planned.frames, PHONE, 'built')).toMatchObject({ assignment: [0, 1] })
  })

  it('hides, rather than draws, a sticky element that lies wholly outside the clip', () => {
    const clipped = scrollPlan(metrics, PHONE, 1, { x: 0, y: 100, width: 390, height: 600 }, [], 'built')
    if (!('frames' in clipped)) throw new Error('fixture plan refused')
    expect(place([sticky(1000, 1060)], clipped.frames)).toMatchObject({ assignment: [-1] })
  })

  it('refuses chrome that is not visible on frame 0', () => {
    const parked = pinned({ insetTop: 900, insetBottom: 'auto', rect: { left: 0, top: 900, right: 390, bottom: 960 } })
    expect(place([parked])).toStrictEqual(REFUSED)
    const clipped = scrollPlan(metrics, PHONE, 1, { x: 0, y: 100, width: 390, height: 300 }, [], 'built')
    if (!('frames' in clipped)) throw new Error('fixture plan refused')
    expect(place([bar], clipped.frames)).toStrictEqual(REFUSED)
  })

  it('refuses a sticky element taller than a frame', () => {
    expect(place([sticky(100, 945)])).toStrictEqual(REFUSED)
  })

  it('refuses a frame boundary that cuts a sticky element', () => {
    expect(place([sticky(800, 900)])).toStrictEqual(REFUSED)
  })

  it('refuses a boundary that cuts a second sticky element, the first being placed', () => {
    const first = sticky(500, 700)
    const second = sticky(600, 760, { chain: 'body > :nth-child(1) > :nth-child(5)' })
    expect(place([first, second], plan([600]))).toStrictEqual(REFUSED)
  })

  it('refuses two boundaries that do not meet: a gap or an overlap between frames', () => {
    const gap = [
      { offset: 0, cropTop: 0, cropHeight: 400 },
      { offset: 500, cropTop: 0, cropHeight: 844 },
    ]
    const overlap = [
      { offset: 0, cropTop: 0, cropHeight: 844 },
      { offset: 800, cropTop: 0, cropHeight: 844 },
    ]
    expect(place([bar], gap)).toStrictEqual(REFUSED)
    expect(place([bar], overlap)).toStrictEqual(REFUSED)
    expect(place([bar], [])).toStrictEqual(REFUSED)
  })

  it('refuses a fixed element that is not provably on the viewport', () => {
    expect(place([pinned({ insetTop: 'auto', insetBottom: 'auto' })])).toStrictEqual(REFUSED)
    expect(place([pinned({ rect: { left: 0, top: 1584, right: 390, bottom: 1644 } })])).toStrictEqual(REFUSED)
  })

  it('refuses a fixed element with a transform of its own', () => {
    expect(place([pinned({ transform: 'matrix(1, 0, 0, 1, 0, 40)' })])).toStrictEqual(REFUSED)
  })

  it('refuses a sticky element inside a fixed one: no frame can hold it', () => {
    const inside = sticky(100, 160, { chain: 'body > :nth-child(2) > :nth-child(1)' })
    expect(place([bar, inside])).toStrictEqual(REFUSED)
  })

  it('refuses a sticky element with no natural place read', () => {
    expect(place([sticky(0, 0, { natural: undefined })])).toStrictEqual(REFUSED)
  })

  it('names the side it was given', () => {
    expect(stickyPlacement([sticky(100, 945)], plan(), PHONE, 'design', 1)).toStrictEqual({
      reason: 'shot: a pinned element could not be placed (design)',
    })
  })
})

describe('hiddenRule', () => {
  const S = 'body > :nth-child(1) > :nth-child(4)'
  const F = `${S} > :nth-child(1)`
  const B = 'body > :nth-child(2)'
  const hide = (chain: string, except = '') =>
    `${chain}, ${chain} *${except}, ${chain}::before, ${chain}::after, ${chain} *${except}::before, ${chain} *${except}::after { visibility: hidden !important }`
  const show = (chain: string) => `${chain}, ${chain}::before, ${chain}::after { visibility: visible !important }`

  it('hides a unit with its descendants and their pseudo-elements on a frame it is not on', () => {
    const units = [{ chain: S, position: 'sticky' as const }]
    expect(hiddenRule(units, 0, [1])).toBe(hide(S))
  })

  it('is empty when every unit is on the frame', () => {
    const units = [{ chain: S, position: 'sticky' as const }, { chain: B, position: 'fixed' as const }]
    expect(hiddenRule(units, 1, [1, 1])).toBe('')
    expect(hiddenRule([], 0, [])).toBe('')
  })

  it('hides each unit not on the frame, one rule per unit, and hides none that is on it', () => {
    const units = [
      { chain: B, position: 'fixed' as const },
      { chain: S, position: 'sticky' as const },
    ]
    expect(hiddenRule(units, 1, [0, 1])).toBe(hide(B))
    expect(hiddenRule(units, 0, [0, 1])).toBe(hide(S))
    expect(hiddenRule(units, 2, [0, 1])).toBe(`${hide(B)}\n${hide(S)}`)
  })

  it('hides a unit drawn on no frame everywhere', () => {
    expect(hiddenRule([{ chain: S, position: 'sticky' }], 0, [-1])).toBe(hide(S))
  })

  it('on frame 0 keeps a fixed unit inside a hidden sticky one: excluded from the hiding and made visible', () => {
    const units = [
      { chain: S, position: 'sticky' as const },
      { chain: F, position: 'fixed' as const },
    ]
    expect(hiddenRule(units, 0, [1, 0])).toBe(`${hide(S, `:not(${F}, ${F} *)`)}\n${show(F)}`)
  })

  it("on the sticky element's frame hides the fixed unit inside it, and needs no visible rule", () => {
    const units = [
      { chain: S, position: 'sticky' as const },
      { chain: F, position: 'fixed' as const },
    ]
    expect(hiddenRule(units, 1, [1, 0])).toBe(hide(F))
  })

  it('does not exclude a fixed unit that is itself on another frame', () => {
    const units = [
      { chain: S, position: 'sticky' as const },
      { chain: F, position: 'fixed' as const },
    ]
    expect(hiddenRule(units, 2, [1, 0])).toBe(`${hide(S)}\n${hide(F)}`)
  })

  it('does not exclude a fixed unit that is not inside the hidden one', () => {
    const units = [
      { chain: S, position: 'sticky' as const },
      { chain: B, position: 'fixed' as const },
    ]
    expect(hiddenRule(units, 0, [1, 0])).toBe(hide(S))
  })

  it('does not take a sibling whose chain only starts with the same text for a descendant', () => {
    const sibling = 'body > :nth-child(1) > :nth-child(40)'
    const units = [
      { chain: S, position: 'sticky' as const },
      { chain: sibling, position: 'fixed' as const },
    ]
    expect(hiddenRule(units, 0, [1, 0])).toBe(hide(S))
  })
})

describe('shiftMiss', () => {
  const MISS = 'shot: the page changed while it was shot (built)'
  type Entry = Snapshot['entries'][number]
  const entry = (path: string, over: Partial<Entry> = {}): Entry => ({
    path,
    ordinal: 0,
    top: 100,
    width: 390,
    height: 60,
    pinned: false,
    same_node: true,
    ...over,
  })
  const base = [entry('main'), entry('div.bar', { top: 784, pinned: true })]
  const read = (over: Partial<FrameRead> = {}, entries: Entry[] = base): FrameRead => ({
    offset: 0,
    scrollTop: 0,
    scrollHeight: 2000,
    viewport: PHONE,
    vvAlto: null,
    snapshot: { entries, counts: { main: 1, 'div.bar': 1 } },
    ...over,
  })
  const later = (over: Partial<FrameRead>, entries: Entry[] = scrolled) =>
    read({ offset: 844, scrollTop: 844, ...over }, entries)
  // The same page on a frame scrolled by 844: a flow element's viewport top moved by exactly the scroll.
  const scrolled = [entry('main', { top: 100 - 844 }), entry('div.bar', { top: 12, pinned: true })]
  const withCounts = (frame: FrameRead, counts: Record<string, number>): FrameRead => ({
    ...frame,
    snapshot: { ...frame.snapshot, counts },
  })

  it('is null for the same page one frame further down', () => {
    expect(shiftMiss(read(), later({}), 'built')).toBeNull()
    expect(shiftMiss(read(), read(), 'built')).toBeNull()
  })

  it('misses a scrollTop that is not the planned offset, on either frame', () => {
    expect(shiftMiss(read(), later({ scrollTop: 843 }), 'built')).toBe(MISS)
    expect(shiftMiss(read({ scrollTop: 1 }), read(), 'built')).toBe(MISS)
  })

  it('misses a different scrollHeight or viewport', () => {
    expect(shiftMiss(read(), later({ scrollHeight: 2001 }), 'built')).toBe(MISS)
    expect(shiftMiss(read(), later({ viewport: { width: 390, height: 700 } }), 'built')).toBe(MISS)
    expect(shiftMiss(read(), later({ viewport: { width: 380, height: 844 } }), 'built')).toBe(MISS)
  })

  it('misses a different inline --vv-alto', () => {
    expect(shiftMiss(read({ vvAlto: '844px' }), later({ vvAlto: '812px' }), 'built')).toBe(MISS)
    expect(shiftMiss(read({ vvAlto: '844px' }), later({ vvAlto: '844px' }), 'built')).toBeNull()
  })

  it('misses an element that is not pinned whose page top, width or height changed', () => {
    const moved = [entry('main', { top: 100 - 844 + 1 }), scrolled[1]]
    const wider = [entry('main', { top: 100 - 844, width: 391 }), scrolled[1]]
    const taller = [entry('main', { top: 100 - 844, height: 61 }), scrolled[1]]
    const shorter = [entry('main', { top: 100 - 844, height: 59 }), scrolled[1]]
    for (const entries of [moved, wider, taller, shorter]) expect(shiftMiss(read(), later({}, entries), 'built')).toBe(MISS)
  })

  it('misses a replaced node, pinned or not', () => {
    const plain = [entry('main', { top: -744, same_node: false }), scrolled[1]]
    const bar = [scrolled[0], entry('div.bar', { top: 12, pinned: true, same_node: false })]
    expect(shiftMiss(read(), later({}, plain), 'built')).toBe(MISS)
    expect(shiftMiss(read(), later({}, bar), 'built')).toBe(MISS)
  })

  it('misses an element that is gone and a count that changed', () => {
    expect(shiftMiss(read(), later({}, [scrolled[1]]), 'built')).toBe(MISS)
    const more = withCounts(later({}, [...scrolled, entry('p')]), { main: 1, 'div.bar': 1, p: 1 })
    expect(shiftMiss(read(), more, 'built')).toBe(MISS)
    expect(shiftMiss(read(), withCounts(later({}), { main: 2, 'div.bar': 1 }), 'built')).toBe(MISS)
  })

  it('does not compare the top of a pinned element, only its size', () => {
    const lower = [scrolled[0], entry('div.bar', { top: 700, pinned: true })]
    const taller = [scrolled[0], entry('div.bar', { top: 12, pinned: true, height: 61 })]
    const narrower = [scrolled[0], entry('div.bar', { top: 12, pinned: true, width: 380 })]
    expect(shiftMiss(read(), later({}, lower), 'built')).toBeNull()
    expect(shiftMiss(read(), later({}, taller), 'built')).toBe(MISS)
    expect(shiftMiss(read(), later({}, narrower), 'built')).toBe(MISS)
  })

  it('misses an element that became or stopped being pinned', () => {
    expect(shiftMiss(read(), later({}, [scrolled[0], entry('div.bar', { top: 12, pinned: false })]), 'built')).toBe(MISS)
  })

  it('names the side it was given', () => {
    expect(shiftMiss(read(), later({ scrollHeight: 1 }), 'design')).toBe('shot: the page changed while it was shot (design)')
  })
})

describe('innerScrollMiss', () => {
  const MISS = 'shot: the page scrolls inside an element (design)'
  const fits = { scrollHeight: 844, innerHeight: 844 }
  const long = { scrollHeight: 2000, innerHeight: 844 }

  it('misses a non-layer element that scrolls while the document does not', () => {
    expect(innerScrollMiss(fits, [{ scrollHeight: 1200, clientHeight: 600 }], 'design')).toBe(MISS)
  })

  it('is null when the document is the one that scrolls, or nothing scrolls', () => {
    expect(innerScrollMiss(long, [{ scrollHeight: 1200, clientHeight: 600 }], 'design')).toBeNull()
    expect(innerScrollMiss(fits, [{ scrollHeight: 600, clientHeight: 600 }], 'design')).toBeNull()
    expect(innerScrollMiss(fits, [], 'design')).toBeNull()
  })
})

describe('stickyProbeOffset', () => {
  const footer = (over: Partial<Pinned> = {}): Pinned =>
    pinned({ position: 'sticky', insetBottom: 0, insetTop: 'auto', container: { contentTop: 100, contentBottom: 1500 }, ...over })

  it('puts the bottom of a container last in the document at the bottom of the viewport', () => {
    expect(stickyProbeOffset(footer({ container: { contentTop: 100, contentBottom: 2000 } }), PHONE, 1156)).toBe(1156)
  })

  it('scrolls a container in mid-document just so its content bottom meets the inset', () => {
    expect(stickyProbeOffset(footer({ insetBottom: 24 }), PHONE, 1156)).toBe(1500 + 24 - 844)
  })

  it('clamps to 0 for a container shorter than the viewport', () => {
    expect(stickyProbeOffset(footer({ container: { contentTop: 0, contentBottom: 500 } }), PHONE, 1156)).toBe(0)
  })

  it('clamps to the largest offset the page can scroll to', () => {
    expect(stickyProbeOffset(footer({ container: { contentTop: 0, contentBottom: 3000 } }), PHONE, 1156)).toBe(1156)
  })

  it('puts the container top at the inset for a top-sticky element', () => {
    const header = pinned({ position: 'sticky', insetTop: 56, insetBottom: 'auto', container: { contentTop: 1200, contentBottom: 1900 } })
    expect(stickyProbeOffset(header, PHONE, 1156)).toBe(1144)
    expect(stickyProbeOffset({ ...header, container: { contentTop: 20, contentBottom: 900 } }, PHONE, 1156)).toBe(0)
  })

  it('is 0 for a sticky element with no inset: it never sticks', () => {
    expect(stickyProbeOffset(pinned({ position: 'sticky', insetTop: 'auto', insetBottom: 'auto' }), PHONE, 1156)).toBe(0)
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

describe('the calm page', () => {
  it('zeroes the four animation and transition declarations on every element', () => {
    expect(CALM_CSS.startsWith('*, *::before, *::after {')).toBe(true)
    for (const property of ['animation-duration', 'animation-delay', 'transition-duration', 'transition-delay']) {
      expect(CALM_CSS).toContain(`${property}: 0s !important;`)
    }
  })

  it('has the probe sheet carry the caret rule and the calm rule', () => {
    expect(PROBE_CSS).toContain('*, *::before, *::after { caret-color: transparent !important; }')
    expect(PROBE_CSS).toContain(CALM_CSS)
  })

  it('builds the context options of a row with reduced motion', () => {
    expect(CALM_CONTEXT).toEqual({ reducedMotion: 'reduce' })
    expect(captureContextOptions({ width: 390, height: 844, url: 'http://127.0.0.1:1' })).toEqual({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      colorScheme: 'light',
      baseURL: 'http://127.0.0.1:1',
      reducedMotion: 'reduce',
    })
  })
})

describe('named', () => {
  it('builds only the lines of its fixed table, for a known side', () => {
    expect(named('no built screen yet', 'built')).toBe('shot: no built screen yet (built)')
    expect(() => named('Nueva venta 12', 'built')).toThrow('shot: a reason outside the fixed table')
    expect(() => named('did not settle', 'both' as 'built')).toThrow('shot: a reason outside the fixed table')
  })
})

describe('shotReason', () => {
  it('keeps a known line of the same side', () => {
    const line = layerMiss({ left: -1, top: 0, right: 10, bottom: 10 }, PHONE, [], 'design') as string
    expect(shotReason(line, 'design')).toBe(line)
    expect(shotReason(shotStepReason('timeout', 'built'), 'built')).toBe('shot: timed out taking the shot (built)')
  })

  it('maps both settle reasons to did not settle', () => {
    expect(shotReason(SETTLE_REASON_UNSETTLED, 'built')).toBe('shot: did not settle (built)')
    expect(shotReason(SETTLE_REASON_REJECTED, 'design')).toBe('shot: did not settle (design)')
  })

  it('maps anything else, page text and a shot: look-alike included, to could not take the shot', () => {
    const text = 'estado no alcanzado en {"click":"Cobrar 4500"}: timeout'
    expect(shotReason(text, 'built')).toBe('shot: could not take the shot (built)')
    expect(shotReason('shot: Nueva venta 4500 (built)', 'built')).toBe('shot: could not take the shot (built)')
    expect(shotReason('shot: did not settle (design)', 'built')).toBe('shot: could not take the shot (built)')
  })
})

describe('rowCapture', () => {
  it('is captured with no reasons when both paths are set', () => {
    expect(rowCapture({ design: { path: '/a.design.png' }, built: { path: '/a.built.png', reason: 'ignored' } })).toEqual({
      capture: 'captured',
    })
  })

  it('is not captured, with the built reason, for a screen not built yet', () => {
    expect(
      rowCapture({
        design: { path: '/a.design.png', reason: null },
        built: { path: null, reason: named('no built screen yet', 'built') },
      }),
    ).toEqual({ capture: 'not-captured', reasons: { built: 'shot: no built screen yet (built)' } })
  })

  it('is not captured for a built step failure and keeps the design side out of reasons', () => {
    const result = rowCapture({
      design: { path: '/a.design.png', reason: null },
      built: { path: null, reason: shotStepReason('error', 'built') },
    })
    expect(result).toEqual({ capture: 'not-captured', reasons: { built: 'shot: could not take the shot (built)' } })
  })

  it('has both reasons when neither side has a capture', () => {
    expect(
      rowCapture({
        design: { path: null, reason: named('did not settle', 'design') },
        built: { path: null, reason: named('no built screen yet', 'built') },
      }),
    ).toEqual({
      capture: 'not-captured',
      reasons: { design: 'shot: did not settle (design)', built: 'shot: no built screen yet (built)' },
    })
  })
})
