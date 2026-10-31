import { renderHook } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { exceedsDecimals, typedDecimals, useDecimalsSentence } from './unitDecimals'

describe('typedDecimals', () => {
  test.each([
    ['2', 0],
    ['2,5', 1],
    ['2.55', 2],
    ['2.555', 3],
    ['1,50', 1],
    ['1,00', 0],
  ])('counts the decimals of %s', (text, expected) => {
    expect(typedDecimals(text)).toBe(expected)
  })

  test('is null for text that is no number', () => {
    expect(typedDecimals('abc')).toBeNull()
    expect(typedDecimals('')).toBeNull()
  })
})

describe('exceedsDecimals', () => {
  test('refuses a typed value finer than the unit', () => {
    expect(exceedsDecimals('1.5', 0)).toBe(true)
    expect(exceedsDecimals('2.555', 2)).toBe(true)
    expect(exceedsDecimals('1.25', 1)).toBe(true)
  })

  test('lets a value the unit admits through, trailing zeros included', () => {
    expect(exceedsDecimals('3', 0)).toBe(false)
    expect(exceedsDecimals('1,50', 1)).toBe(false)
    expect(exceedsDecimals('2.55', 2)).toBe(false)
  })

  test('leaves text that is no number to the field own check', () => {
    expect(exceedsDecimals('abc', 0)).toBe(false)
  })
})

describe('useDecimalsSentence', () => {
  test('says what the unit allows', () => {
    const { result } = renderHook(() => useDecimalsSentence())
    expect(result.current(0)).toBe('Whole units only')
    expect(result.current(1)).toBe('Up to 1 decimal')
    expect(result.current(2)).toBe('Up to 2 decimals')
  })
})
