import { describe, expect, test } from 'vitest'
import { formatGrams, formatMoney } from './money'

describe('formatMoney', () => {
  test('whole pesos with a dot as the thousands separator', () => {
    expect(formatMoney(11000)).toBe('$ 11.000')
  })

  test('rounds to the nearest peso', () => {
    expect(formatMoney(10999.6)).toBe('$ 11.000')
  })

  test('a small amount carries no thousands dot', () => {
    expect(formatMoney(500)).toBe('$ 500')
  })

  test('a seven-figure amount gets two dots', () => {
    expect(formatMoney(1234567)).toBe('$ 1.234.567')
  })

  test('zero', () => {
    expect(formatMoney(0)).toBe('$ 0')
  })
})

describe('formatGrams', () => {
  test('a whole amount carries no decimals', () => {
    expect(formatGrams(10)).toBe('10 g')
  })

  test('up to two decimals with a comma', () => {
    expect(formatGrams(3.5)).toBe('3,5 g')
  })

  test('a decimal string from the API is read the same way', () => {
    expect(formatGrams('18.50')).toBe('18,5 g')
  })
})
