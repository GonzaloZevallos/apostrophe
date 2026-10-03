import { describe, expect, test } from 'vitest'
import { parseGrams, parseMoney } from './parse'

describe('parseMoney', () => {
  test('reads whole pesos with a dot as the thousands separator', () => {
    expect(parseMoney('11.000')).toEqual({ ok: true, value: 11000 })
  })

  test('reads whole pesos typed with no separator at all', () => {
    expect(parseMoney('4500')).toEqual({ ok: true, value: 4500 })
  })

  test('rejects a decimal amount: money never carries cents', () => {
    expect(parseMoney('11.00')).toEqual({ ok: false })
  })

  test('rejects zero, a negative sign and empty input', () => {
    expect(parseMoney('0')).toEqual({ ok: false })
    expect(parseMoney('-500')).toEqual({ ok: false })
    expect(parseMoney('')).toEqual({ ok: false })
    expect(parseMoney('   ')).toEqual({ ok: false })
  })

  test('rejects anything that is not digits and dots', () => {
    expect(parseMoney('11,000')).toEqual({ ok: false })
    expect(parseMoney('$ 11.000')).toEqual({ ok: false })
    expect(parseMoney('abc')).toEqual({ ok: false })
  })
})

describe('parseGrams', () => {
  test('reads grams with a comma and keeps a decimal string, not a float', () => {
    expect(parseGrams('3,5')).toEqual({ ok: true, value: '3.5' })
  })

  test('reads grams with a dot and up to two decimals', () => {
    expect(parseGrams('10.25')).toEqual({ ok: true, value: '10.25' })
  })

  test('reads a whole number of grams', () => {
    expect(parseGrams('10')).toEqual({ ok: true, value: '10' })
  })

  test('rejects more than two decimals', () => {
    expect(parseGrams('3,555')).toEqual({ ok: false })
  })

  test('rejects zero, a negative amount and empty input', () => {
    expect(parseGrams('0')).toEqual({ ok: false })
    expect(parseGrams('-3,5')).toEqual({ ok: false })
    expect(parseGrams('')).toEqual({ ok: false })
  })
})
