import { describe, expect, it } from 'vitest'
import e2eHelper from '../../e2e/helpers/textScale.ts?raw'
import { TEXT_SCALE, TOLERANCE, unscaled, type ScaleRecord } from '../../../scripts/design/textScale.mjs'

const FACTOR = 1.3

// An element that took the scale: 16 px / 24 px at baseline, 20.8 px / 31.2 px after.
const took = (overrides: Partial<ScaleRecord> = {}): ScaleRecord => ({
  tagged: true,
  baselineFontPx: 16,
  fontPx: 20.8,
  baselineLineHeightPx: 24,
  lineHeightPx: 31.2,
  ...overrides,
})

describe('unscaled', () => {
  it('has no miss when every element reads baseline × factor', () => {
    expect(unscaled([took(), took({ baselineFontPx: 12, fontPx: 15.6 })], FACTOR, TOLERANCE)).toEqual([])
  })

  it('misses an element mounted after the scale was applied (untagged)', () => {
    const records = [took(), took({ tagged: false, fontPx: 16, lineHeightPx: 24 })]
    expect(unscaled(records, FACTOR, TOLERANCE)).toEqual([{ index: 1, kind: 'untagged' }])
  })

  it('leaves a normal line-height alone', () => {
    const normal = took({ baselineLineHeightPx: null, lineHeightPx: null })
    expect(unscaled([normal], FACTOR, TOLERANCE)).toEqual([])
  })

  it('misses a px line-height that was not scaled', () => {
    expect(unscaled([took({ lineHeightPx: 24 })], FACTOR, TOLERANCE)).toEqual([{ index: 0, kind: 'line-height' }])
  })

  it('misses a line-height that turned into normal after having a size', () => {
    expect(unscaled([took({ lineHeightPx: null })], FACTOR, TOLERANCE)).toEqual([{ index: 0, kind: 'line-height' }])
  })

  it('misses a font size that was not scaled', () => {
    expect(unscaled([took({ fontPx: 16 })], FACTOR, TOLERANCE)).toEqual([{ index: 0, kind: 'font-size' }])
  })

  it('passes a value inside the tolerance and misses one just outside it', () => {
    expect(unscaled([took({ fontPx: 20.8 + TOLERANCE })], FACTOR, TOLERANCE)).toEqual([])
    expect(unscaled([took({ fontPx: 20.8 - TOLERANCE })], FACTOR, TOLERANCE)).toEqual([])
    expect(unscaled([took({ fontPx: 20.8 + TOLERANCE + 0.01 })], FACTOR, TOLERANCE)).toEqual([{ index: 0, kind: 'font-size' }])
    expect(unscaled([took({ lineHeightPx: 31.2 - TOLERANCE - 0.01 })], FACTOR, TOLERANCE)).toEqual([{ index: 0, kind: 'line-height' }])
  })

  it('misses a page with nothing to scale: a verify of zero elements proves nothing', () => {
    expect(unscaled([], FACTOR, TOLERANCE)).toEqual([{ index: -1, kind: 'none' }])
  })
})

describe('the two copies of the text-scale model', () => {
  const literal = (name: string): number => {
    const match = new RegExp(`export const ${name} = ([0-9.]+)`).exec(e2eHelper)
    expect(match, `${name} in web/e2e/helpers/textScale.ts`).not.toBeNull()
    return Number(match?.[1])
  }

  it('agree on the scale and the tolerance', () => {
    expect(literal('TEXT_SCALE')).toBe(TEXT_SCALE)
    expect(literal('TOLERANCE')).toBe(TOLERANCE)
  })
})
