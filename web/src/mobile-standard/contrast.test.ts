import { describe, expect, test } from 'vitest'
import { composite, MIN_CONTRAST, parseColor, ratio, relativeLuminance } from './contrast.ts'

describe('ratio', () => {
  test('black on white is 21:1 and a colour on itself 1:1', () => {
    expect(ratio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 5)
    expect(ratio({ r: 9, g: 9, b: 9 }, { r: 9, g: 9, b: 9 })).toBeCloseTo(1, 5)
  })

  test('is symmetric in its two colours', () => {
    const a = { r: 154, g: 144, b: 133 }
    const b = { r: 252, g: 251, b: 248 }
    expect(ratio(a, b)).toBe(ratio(b, a))
  })

  test('--tenue on --papel is the 3.03 the README documents, below the minimum', () => {
    const tenue = parseColor('#9a9085')
    const papel = parseColor('#fcfbf8')
    expect(ratio(tenue, papel)).toBeCloseTo(3.03, 2)
    expect(ratio(tenue, papel)).toBeLessThan(MIN_CONTRAST)
  })

  test('the minimum is 4.5, with no large-text relaxation', () => {
    expect(MIN_CONTRAST).toBe(4.5)
  })
})

describe('relativeLuminance', () => {
  test('is 0 for black and 1 for white', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0)
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 10)
  })
})

describe('composite', () => {
  test('a colour at alpha 1 hides the base, at alpha 0 shows it', () => {
    const base = { r: 10, g: 20, b: 30 }
    expect(composite({ r: 200, g: 100, b: 50, a: 1 }, base)).toEqual({ r: 200, g: 100, b: 50 })
    expect(composite({ r: 200, g: 100, b: 50, a: 0 }, base)).toEqual(base)
  })

  test('half-transparent white over black is mid grey', () => {
    expect(composite({ r: 255, g: 255, b: 255, a: 0.5 }, { r: 0, g: 0, b: 0 })).toEqual({
      r: 127.5,
      g: 127.5,
      b: 127.5,
    })
  })

  test('opacity multiplies the alpha of the colour', () => {
    const out = composite({ r: 255, g: 255, b: 255, a: 0.5 }, { r: 0, g: 0, b: 0 }, 0.5)
    expect(out.r).toBeCloseTo(63.75, 5)
  })
})

describe('parseColor', () => {
  test('reads #rrggbb, rgb() and rgba() as the browser reports them', () => {
    expect(parseColor('#fcfbf8')).toEqual({ r: 252, g: 251, b: 248 })
    expect(parseColor('rgb(16, 19, 26)')).toEqual({ r: 16, g: 19, b: 26 })
    expect(parseColor('rgba(16, 19, 26, 0.4)')).toEqual({ r: 16, g: 19, b: 26, a: 0.4 })
  })

  test('refuses what it cannot read instead of guessing', () => {
    expect(() => parseColor('transparent')).toThrow()
    expect(() => parseColor('oklch(0.5 0.1 20)')).toThrow()
  })
})
