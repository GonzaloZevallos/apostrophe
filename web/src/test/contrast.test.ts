import { describe, expect, it } from 'vitest'
import { composite, contrastRatio, parseColour } from './contrast'

describe('contrast on computed colours', () => {
  it('pins the values tests/test_design_contrast.py asserts', () => {
    const black = parseColour('rgb(0, 0, 0)')
    const white = parseColour('rgb(255, 255, 255)')
    expect(Math.round(contrastRatio(black, white) * 100) / 100).toBe(21)
    const same = parseColour('rgb(18, 52, 86)')
    expect(contrastRatio(same, same)).toBe(1)
  })

  it('reads the comma and the space syntax, with and without alpha', () => {
    expect(parseColour('rgb(1, 2, 3)')).toEqual({ r: 1, g: 2, b: 3, a: 1 })
    expect(parseColour('rgba(1, 2, 3, 0.5)')).toEqual({ r: 1, g: 2, b: 3, a: 0.5 })
    expect(parseColour('rgb(1 2 3 / 0.25)')).toEqual({ r: 1, g: 2, b: 3, a: 0.25 })
    expect(() => parseColour('#123456')).toThrow('not a computed colour')
  })

  it('composites a colour at its opacity over an opaque backdrop', () => {
    const over = composite(parseColour('rgb(255, 255, 255)'), 0.75, parseColour('rgb(0, 0, 0)'))
    expect(over).toEqual({ r: 191.25, g: 191.25, b: 191.25, a: 1 })
    expect(composite(parseColour('rgba(255, 0, 0, 0)'), 1, parseColour('rgb(9, 9, 9)'))).toEqual({ r: 9, g: 9, b: 9, a: 1 })
  })

  it('refuses a translucent backdrop', () => {
    expect(() => composite(parseColour('rgb(0, 0, 0)'), 1, parseColour('rgba(255, 255, 255, 0.5)'))).toThrow(
      'the backdrop must be opaque',
    )
  })
})
