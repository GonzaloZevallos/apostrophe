import { describe, expect, it } from 'vitest'
import {
  SETTLE_ADVANCE_MS,
  SETTLE_BOUND,
  SETTLE_FRAMES,
  SETTLE_REASON_REJECTED,
  SETTLE_REASON_UNSETTLED,
  settleWith,
  signatureOf,
  sideOutcome,
  type LayoutPage,
  type LayoutRecord,
  type SettleFrame,
  type SettlePort,
} from '../../../scripts/design/settle.mjs'

const calm = (hash: string): SettleFrame => ({
  idle: true,
  pendingFiniteAnimation: false,
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

  it('never settles while a finite animation is pending', async () => {
    const busy = { ...calm('a'), pendingFiniteAnimation: true }
    const { port, log } = portOf([busy])
    expect(await settleWith(port, options)).toBe(SETTLE_REASON_UNSETTLED)
    expect(log.frames).toBe(SETTLE_BOUND)
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
})

describe('signatureOf', () => {
  const record: LayoutRecord = {
    tag: 'DIV',
    left: 8,
    top: 16,
    width: 100,
    height: 40,
    text: 'Hola',
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

  it('does not tell texts apart from their neighbours by concatenation', () => {
    const one: LayoutRecord = { ...record, text: 'ab' }
    const two: LayoutRecord = { ...record, text: 'c' }
    const left = signatureOf([{ ...one, text: 'a' }, { ...two, text: 'bc' }], page)
    const right = signatureOf([one, two], page)
    expect(left).not.toBe(right)
  })

  it('reads only the six record fields, so no transform can enter the hash', () => {
    const withTransform = { ...record, transform: 'translateX(10px)', opacity: '0.5' }
    expect(signatureOf([withTransform], page)).toBe(signatureOf([record], page))
    expect(Object.keys(record).sort()).toEqual(
      ['height', 'left', 'tag', 'text', 'top', 'width'].sort(),
    )
  })

  it('is self-contained, so it can be sent to the browser as page.evaluate source', () => {
    const source = signatureOf.toString()
    const rebuilt = new Function(`return (${source})`)() as typeof signatureOf
    expect(rebuilt([record], page)).toBe(signatureOf([record], page))
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
