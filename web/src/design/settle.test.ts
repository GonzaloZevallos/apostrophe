import { describe, expect, it } from 'vitest'
import {
  SETTLE_ADVANCE_MS,
  SETTLE_BOUND,
  SETTLE_FRAMES,
  SETTLE_QUIET_HOPS,
  SETTLE_REASON_REJECTED,
  SETTLE_REASON_UNSETTLED,
  animationRecords,
  frameRecords,
  settleWith,
  shotKept,
  signatureOf,
  sideOutcome,
  unfinished,
  type AnimationRecord,
  type LayoutPage,
  type LayoutRecord,
  type SettleFrame,
  type SettlePort,
} from '../../../scripts/design/settle.mjs'

const calm = (hash: string): SettleFrame => ({
  idle: true,
  unfinishedAnimation: false,
  mutated: false,
  fontsLoaded: true,
  hash,
})

// A port that answers `frames` in order (the last one repeats), counting its calls.
function portOf(frames: ReadonlyArray<SettleFrame | Error>) {
  const log = { advances: [] as number[], frames: 0 }
  const port: SettlePort = {
    advance: (ms) => {
      log.advances.push(ms)
      return Promise.resolve()
    },
    frame: () => {
      const next = frames.at(Math.min(log.frames, frames.length - 1))
      log.frames += 1
      if (next === undefined) return Promise.reject(new Error('no frames given'))
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
    },
  }
  return { port, log }
}

const options = { advanceMs: 0, frames: SETTLE_FRAMES, bound: SETTLE_BOUND }

describe('settle constants', () => {
  it('fixes the advance, the run of equal frames and the bound', () => {
    expect(SETTLE_ADVANCE_MS).toBe(350)
    expect(SETTLE_FRAMES).toBe(3)
    expect(SETTLE_BOUND).toBe(120)
  })

  it('waits a whole number of real hops for a commit that lands after the first one', () => {
    expect(Number.isInteger(SETTLE_QUIET_HOPS)).toBe(true)
    expect(SETTLE_QUIET_HOPS).toBeGreaterThanOrEqual(1)
  })
})

describe('settleWith', () => {
  it('settles after exactly three equal calm frames', async () => {
    const { port, log } = portOf([calm('a')])
    expect(await settleWith(port, options)).toBeNull()
    expect(log.frames).toBe(3)
  })

  it('settles after k > 3 frames when the layout keeps moving first', async () => {
    const { port, log } = portOf([calm('1'), calm('2'), calm('3'), calm('4'), calm('5'), calm('6')])
    expect(await settleWith(port, options)).toBeNull()
    // '1'..'5' differ from each other; the sixth and its two repeats are the first three equal.
    expect(log.frames).toBe(8)
  })

  it('restarts the count when the hash changes after an equal frame', async () => {
    const { port, log } = portOf([calm('a'), calm('a'), calm('b')])
    expect(await settleWith(port, options)).toBeNull()
    expect(log.frames).toBe(5)
  })

  it('never settles while every frame finishes an animation', async () => {
    const busy = { ...calm('a'), unfinishedAnimation: true }
    const { port, log } = portOf([busy])
    expect(await settleWith(port, options)).toBe(SETTLE_REASON_UNSETTLED)
    expect(log.frames).toBe(SETTLE_BOUND)
  })

  it('never settles while every frame saw a DOM mutation, however equal the hash', async () => {
    const { port, log } = portOf([{ ...calm('a'), mutated: true }])
    expect(await settleWith(port, options)).toBe(SETTLE_REASON_UNSETTLED)
    expect(log.frames).toBe(SETTLE_BOUND)
  })

  it('restarts the count when a mutated frame has the same hash as its neighbours', async () => {
    const mutated = { ...calm('a'), mutated: true }
    const { port, log } = portOf([calm('a'), calm('a'), mutated, calm('a')])
    expect(await settleWith(port, options)).toBeNull()
    expect(log.frames).toBe(6)
  })

  it('restarts the count when a frame finished an animation, same hash included', async () => {
    const finished = { ...calm('a'), unfinishedAnimation: true }
    const { port, log } = portOf([calm('a'), calm('a'), finished, calm('a')])
    expect(await settleWith(port, options)).toBeNull()
    expect(log.frames).toBe(6)
  })

  it('never settles while fonts are not loaded', async () => {
    const { port } = portOf([{ ...calm('a'), fontsLoaded: false }])
    expect(await settleWith(port, options)).toBe(SETTLE_REASON_UNSETTLED)
  })

  it('never settles while a fetch is in flight', async () => {
    const { port } = portOf([{ ...calm('a'), idle: false }])
    expect(await settleWith(port, options)).toBe(SETTLE_REASON_UNSETTLED)
  })

  it('restarts the count when a calm run is broken by a busy frame with the same hash', async () => {
    const busy = { ...calm('a'), idle: false }
    const { port, log } = portOf([calm('a'), calm('a'), busy, calm('a')])
    expect(await settleWith(port, options)).toBeNull()
    expect(log.frames).toBe(6)
  })

  it('stops at the bound with the unsettled reason when the hash never repeats', async () => {
    let n = 0
    const log = { frames: 0 }
    const port: SettlePort = {
      advance: () => Promise.resolve(),
      frame: () => {
        log.frames += 1
        n += 1
        return Promise.resolve(calm(String(n)))
      },
    }
    expect(await settleWith(port, options)).toBe(SETTLE_REASON_UNSETTLED)
    expect(log.frames).toBe(SETTLE_BOUND)
  })

  it('gives a different, fixed reason when a frame rejects, never the error text', async () => {
    const { port } = portOf([calm('a'), new Error('Timeout 30000ms exceeded for Ana')])
    const reason = await settleWith(port, options)
    expect(reason).toBe(SETTLE_REASON_REJECTED)
    expect(reason).not.toBe(SETTLE_REASON_UNSETTLED)
    expect(reason).not.toContain('Ana')
  })

  it('gives the rejected reason when the advance rejects, without sampling a frame', async () => {
    const log = { frames: 0 }
    const port: SettlePort = {
      advance: () => Promise.reject(new Error('stalled')),
      frame: () => {
        log.frames += 1
        return Promise.resolve(calm('a'))
      },
    }
    expect(await settleWith(port, { ...options, advanceMs: SETTLE_ADVANCE_MS })).toBe(
      SETTLE_REASON_REJECTED,
    )
    expect(log.frames).toBe(0)
  })

  it('advances once with the given milliseconds, before the first frame', async () => {
    const { port, log } = portOf([calm('a')])
    await settleWith(port, { ...options, advanceMs: SETTLE_ADVANCE_MS })
    expect(log.advances).toEqual([350])
  })

  it('does not advance at all when advanceMs is 0', async () => {
    const { port, log } = portOf([calm('a')])
    await settleWith(port, options)
    expect(log.advances).toEqual([])
  })

  it('answers with reasons that carry no page data', () => {
    for (const reason of [SETTLE_REASON_UNSETTLED, SETTLE_REASON_REJECTED]) {
      expect(reason).toMatch(/^[^0-9$]+$/)
    }
  })

  it('names the rest failure by its fixed sentence', () => {
    expect(SETTLE_REASON_UNSETTLED).toBe('la pantalla no quedó quieta')
  })
})

describe('signatureOf', () => {
  const record: LayoutRecord = {
    tag: 'DIV',
    left: 8,
    top: 16,
    width: 100,
    height: 40,
    text: 'Hola',
    disabled: false,
    checked: false,
    ariaChecked: null,
    ariaPressed: null,
    ariaSelected: null,
    ariaDisabled: null,
    ariaBusy: null,
  }
  const page: LayoutPage = {
    scrollWidth: 390,
    scrollHeight: 800,
    imagesComplete: true,
    fontsLoaded: true,
  }

  it('is a 32-bit hex string, identical for identical input', () => {
    const a = signatureOf([record], page)
    expect(a).toMatch(/^[0-9a-f]{8}$/)
    expect(signatureOf([{ ...record }], { ...page })).toBe(a)
  })

  it('changes with text, geometry, tag and order', () => {
    const base = signatureOf([record], page)
    const variants: LayoutRecord[] = [
      { ...record, text: 'Chau' },
      { ...record, left: 9 },
      { ...record, top: 17 },
      { ...record, width: 101 },
      { ...record, height: 41 },
      { ...record, tag: 'SPAN' },
    ]
    for (const variant of variants) expect(signatureOf([variant], page)).not.toBe(base)
    const other: LayoutRecord = { ...record, tag: 'P' }
    expect(signatureOf([record, other], page)).not.toBe(signatureOf([other, record], page))
  })

  it('changes with imagesComplete, fontsLoaded and the scroll size', () => {
    const base = signatureOf([record], page)
    const variants: LayoutPage[] = [
      { ...page, imagesComplete: false },
      { ...page, fontsLoaded: false },
      { ...page, scrollHeight: 801 },
      { ...page, scrollWidth: 391 },
    ]
    for (const variant of variants) expect(signatureOf([record], variant)).not.toBe(base)
  })

  it('tells texts apart from their neighbours: moving text between records changes the hash', () => {
    const one: LayoutRecord = { ...record, text: 'ab' }
    const two: LayoutRecord = { ...record, text: 'c' }
    const left = signatureOf([{ ...one, text: 'a' }, { ...two, text: 'bc' }], page)
    const right = signatureOf([one, two], page)
    expect(left).not.toBe(right)
  })

  it('changes with each control state of the closed list, though no box moves', () => {
    const base = signatureOf([record], page)
    const variants: LayoutRecord[] = [
      { ...record, disabled: true },
      { ...record, checked: true },
      { ...record, ariaChecked: 'true' },
      { ...record, ariaPressed: 'true' },
      { ...record, ariaSelected: 'true' },
      { ...record, ariaDisabled: 'true' },
      { ...record, ariaBusy: 'true' },
    ]
    const hashes = variants.map((variant) => signatureOf([variant], page))
    for (const hash of hashes) expect(hash).not.toBe(base)
    expect(new Set(hashes).size).toBe(variants.length)
  })

  it('reads only the closed list of record fields, so no style, colour or class can enter the hash', () => {
    const withStyle = { ...record, transform: 'translateX(10px)', opacity: '0.5', color: 'red', className: 'x' }
    expect(signatureOf([withStyle], page)).toBe(signatureOf([record], page))
    expect(Object.keys(record).sort()).toEqual(
      [
        'ariaBusy',
        'ariaChecked',
        'ariaDisabled',
        'ariaPressed',
        'ariaSelected',
        'checked',
        'disabled',
        'height',
        'left',
        'tag',
        'text',
        'top',
        'width',
      ].sort(),
    )
  })

  it('is self-contained, so it can be sent to the browser as page.evaluate source', () => {
    const source = signatureOf.toString()
    const rebuilt = new Function(`return (${source})`)() as typeof signatureOf
    expect(rebuilt([record], page)).toBe(signatureOf([record], page))
  })
})

// What a page offers of itself, as far as the mappers read it.
type StubElement = {
  tagName: string
  offsetLeft: number
  offsetTop: number
  offsetWidth: number
  offsetHeight: number
  childNodes: Array<{ nodeType: number; textContent: string }>
  disabled?: boolean
  checked?: boolean
  attributes?: Record<string, string>
  getAttribute(name: string): string | null
}

function stubElement(over: Partial<StubElement> = {}): StubElement {
  const attributes = over.attributes ?? {}
  return {
    tagName: 'DIV',
    offsetLeft: 1,
    offsetTop: 2,
    offsetWidth: 3,
    offsetHeight: 4,
    childNodes: [
      { nodeType: 3, textContent: 'Hola' },
      { nodeType: 1, textContent: 'ignored child' },
      { nodeType: 3, textContent: ' mundo' },
    ],
    ...over,
    getAttribute: (name) => attributes[name] ?? null,
  }
}

function stubDocument(elements: StubElement[]) {
  const [body, ...rest] = elements
  return { body: { ...body, querySelectorAll: () => rest } }
}

describe('frameRecords', () => {
  const read = (elements: StubElement[]) =>
    (frameRecords as (doc: unknown) => LayoutRecord[])(stubDocument(elements))

  it('reads the body then every element: tag, geometry, own text and the closed control state', () => {
    const button = stubElement({
      tagName: 'BUTTON',
      disabled: true,
      checked: false,
      attributes: { 'aria-checked': 'true', 'aria-busy': 'false' },
    })
    expect(read([stubElement({ tagName: 'BODY' }), button])).toEqual([
      {
        tag: 'BODY',
        left: 1,
        top: 2,
        width: 3,
        height: 4,
        text: 'Hola mundo',
        disabled: false,
        checked: false,
        ariaChecked: null,
        ariaPressed: null,
        ariaSelected: null,
        ariaDisabled: null,
        ariaBusy: null,
      },
      {
        tag: 'BUTTON',
        left: 1,
        top: 2,
        width: 3,
        height: 4,
        text: 'Hola mundo',
        disabled: true,
        checked: false,
        ariaChecked: 'true',
        ariaPressed: null,
        ariaSelected: null,
        ariaDisabled: null,
        ariaBusy: 'false',
      },
    ])
  })

  it('skips an element that has no box of its own, such as an SVG one', () => {
    const svg = { ...stubElement({ tagName: 'svg' }), offsetWidth: undefined } as unknown as StubElement
    expect(read([stubElement({ tagName: 'BODY' }), svg]).map((r) => r.tag)).toEqual(['BODY'])
  })

  it('turns a disabled flip, with no geometry change, into a different hash', () => {
    const hash = (disabled: boolean) =>
      signatureOf(read([stubElement({ tagName: 'BODY' }), stubElement({ tagName: 'BUTTON', disabled })]), {
        scrollWidth: 1,
        scrollHeight: 1,
        imagesComplete: true,
        fontsLoaded: true,
      })
    expect(hash(true)).not.toBe(hash(false))
  })

  it('is self-contained, so it can be sent to the browser as page.evaluate source', () => {
    const rebuilt = new Function(`return (${frameRecords.toString()})`)() as typeof frameRecords
    const doc = stubDocument([stubElement({ tagName: 'BODY' })])
    expect((rebuilt as (d: unknown) => unknown)(doc)).toEqual((frameRecords as (d: unknown) => unknown)(doc))
  })
})

const animation = (over: Partial<{ playState: string; pending: boolean; iterations: number }> = {}) => ({
  playState: over.playState ?? 'idle',
  pending: over.pending ?? false,
  effect: { getComputedTiming: () => ({ iterations: over.iterations ?? 1 }) },
})

describe('animationRecords', () => {
  const read = (list: unknown[]) =>
    (animationRecords as (doc: unknown) => AnimationRecord[])({ getAnimations: () => list })

  it('maps each animation to its play state, pending flag and whether it ends', () => {
    expect(
      read([
        animation({ playState: 'running', pending: true }),
        animation({ playState: 'running', iterations: Infinity }),
        animation({ playState: 'paused' }),
        animation({ playState: 'finished' }),
      ]),
    ).toEqual([
      { playState: 'running', pending: true, finite: true },
      { playState: 'running', pending: false, finite: false },
      { playState: 'paused', pending: false, finite: true },
      { playState: 'finished', pending: false, finite: true },
    ])
  })

  it('reads an animation with no effect as one that never ends', () => {
    expect(read([{ playState: 'running', pending: false, effect: null }])).toEqual([
      { playState: 'running', pending: false, finite: false },
    ])
  })

  it('is self-contained, so it can be sent to the browser as page.evaluate source', () => {
    const rebuilt = new Function(`return (${animationRecords.toString()})`)() as typeof animationRecords
    const doc = { getAnimations: () => [animation({ playState: 'running' })] }
    expect((rebuilt as (d: unknown) => unknown)(doc)).toEqual((animationRecords as (d: unknown) => unknown)(doc))
  })
})

describe('unfinished', () => {
  const record = (playState: string, pending: boolean, finite: boolean): AnimationRecord => ({ playState, pending, finite })

  it('flags a finite animation that is running or has a pending start (a transition not started, a delay)', () => {
    expect(
      unfinished([record('running', false, true), record('idle', true, true), record('running', true, true)]),
    ).toEqual([true, true, true])
  })

  it('never flags a paused, finished or idle one that is not pending', () => {
    expect(unfinished([record('paused', false, true), record('finished', false, true), record('idle', false, true)])).toEqual(
      [false, false, false],
    )
  })

  it('never flags an infinite one, whatever its state', () => {
    expect(unfinished([record('running', false, false), record('running', true, false), record('paused', true, false)])).toEqual(
      [false, false, false],
    )
  })

  it('answers one flag per record, in order, and none for no records', () => {
    expect(unfinished([record('finished', false, true), record('running', false, true), record('paused', false, true)])).toEqual(
      [false, true, false],
    )
    expect(unfinished([])).toEqual([])
  })
})

describe('shotKept', () => {
  it('keeps a shot when the frame after it is calm and has the settled hash', () => {
    expect(shotKept(calm('a'), 'a')).toBe(true)
  })

  it('rejects a frame with a different hash, even when it is calm', () => {
    expect(shotKept(calm('b'), 'a')).toBe(false)
  })

  it('rejects, with the settled hash, a frame that is mutated, not idle, unfinished or without fonts', () => {
    for (const frame of [
      { ...calm('a'), mutated: true },
      { ...calm('a'), idle: false },
      { ...calm('a'), unfinishedAnimation: true },
      { ...calm('a'), fontsLoaded: false },
    ]) {
      expect(shotKept(frame, 'a')).toBe(false)
    }
  })

  it('feeds sideOutcome: a rejected shot leaves the side with no png and the unsettled reason', () => {
    const kept = shotKept({ ...calm('a'), mutated: true }, 'a')
    expect(sideOutcome(kept ? null : SETTLE_REASON_UNSETTLED, 'png-bytes')).toEqual({
      png: null,
      failure: SETTLE_REASON_UNSETTLED,
    })
  })
})

describe('sideOutcome', () => {
  it('keeps the png and no failure when there is no reason', () => {
    expect(sideOutcome(null, 'png-bytes')).toEqual({ png: 'png-bytes', failure: null })
  })

  it('drops the png and carries the reason when the side failed', () => {
    expect(sideOutcome(SETTLE_REASON_UNSETTLED, 'png-bytes')).toEqual({
      png: null,
      failure: SETTLE_REASON_UNSETTLED,
    })
  })
})
