import { describe, expect, test } from 'vitest'
import { parseGrams, parseMoney, parseSignedGrams, readMoneyInput } from './parse'

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

describe('parseSignedGrams', () => {
  test('reads a negative amount, for an adjustment that corrects stock downward', () => {
    expect(parseSignedGrams('-3,5')).toEqual({ ok: true, value: '-3.5' })
    expect(parseSignedGrams('-10')).toEqual({ ok: true, value: '-10' })
  })

  test('still reads a positive amount, with a comma or a dot', () => {
    expect(parseSignedGrams('3,5')).toEqual({ ok: true, value: '3.5' })
    expect(parseSignedGrams('10.25')).toEqual({ ok: true, value: '10.25' })
  })

  test('rejects zero and empty input, negative or not', () => {
    expect(parseSignedGrams('0')).toEqual({ ok: false })
    expect(parseSignedGrams('-0')).toEqual({ ok: false })
    expect(parseSignedGrams('')).toEqual({ ok: false })
  })

  test('rejects more than two decimals', () => {
    expect(parseSignedGrams('-3,555')).toEqual({ ok: false })
  })
})

describe('readMoneyInput', () => {
  test.each([
    ['1000.50', 1000],
    ['15.5', 15],
    ['$ 1.000,50', 1000],
    ['1.000', 1000],
    ['1.234.567', 1234567],
    ['$ 20.000', 20000],
    ['0', 0],
  ])('reads %j as %j whole pesos', (text, expected) => {
    expect(readMoneyInput(text)).toBe(expected)
  })

  test.each([[''], ['$ '], ['abc'], [',50']])('reads %j as nothing', (text) => {
    expect(readMoneyInput(text)).toBeNull()
  })
})

describe('readMoneyInput after a deletion', () => {
  test('one Backspace on the shown "$ 20.000" keeps the dots as thousands: 2000, not 20', () => {
    expect(readMoneyInput('$ 20.00', 'delete')).toBe(2000)
    expect(readMoneyInput('$ 2.000', 'delete')).toBe(2000)
  })

  test('a deletion still drops everything from a comma on, and reads no digits as nothing', () => {
    expect(readMoneyInput('$ 1.000,5', 'delete')).toBe(1000)
    expect(readMoneyInput('$ ', 'delete')).toBeNull()
  })

  test('typed or pasted text keeps the cents rule', () => {
    expect(readMoneyInput('$ 20.00')).toBe(20)
  })
})
