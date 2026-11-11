import { describe, expect, test } from 'vitest'
import vectors from './money.vectors.json'
import type { MoneyFormat } from './money'
import { formatMoneyInput, moneyInputMode, parseGrams, parseMoneyInput, parseSignedGrams, readMoneyInput } from './parse'

const ZERO: MoneyFormat = { symbol: '$', decimals: 0 }
const TWO: MoneyFormat = { symbol: 'US$', decimals: 2 }

describe('parseMoneyInput with 0 decimals (today)', () => {
  test('reads whole pesos with a dot as the thousands separator', () => {
    expect(parseMoneyInput('11.000', ZERO)).toEqual({ ok: true, value: 11000 })
  })

  test('reads whole pesos typed with no separator at all', () => {
    expect(parseMoneyInput('4500', ZERO)).toEqual({ ok: true, value: 4500 })
  })

  test('rejects a decimal amount: this business has no cents', () => {
    expect(parseMoneyInput('11.00', ZERO)).toEqual({ ok: false, tooManyDecimals: false })
    expect(parseMoneyInput('11,5', ZERO)).toEqual({ ok: false, tooManyDecimals: false })
  })

  test('rejects zero, a negative sign and empty input', () => {
    for (const text of ['0', '-500', '', '   ']) {
      expect(parseMoneyInput(text, ZERO)).toEqual({ ok: false, tooManyDecimals: false })
    }
  })

  test('rejects anything that is not digits and dots', () => {
    for (const text of ['11,000', '$ 11.000', 'abc']) {
      expect(parseMoneyInput(text, ZERO).ok).toBe(false)
    }
  })
})

describe('parseMoneyInput with 2 decimals', () => {
  test.each([
    ['11,5', 11.5],
    ['11.5', 11.5],
    ['11.50', 11.5],
    ['11,50', 11.5],
    ['11.000', 11000],
    ['1.000', 1000],
    ['1.234,5', 1234.5],
    ['1.234.567,89', 1234567.89],
    ['4500', 4500],
    ['  11,5 ', 11.5],
  ])('reads %j as %j', (text, value) => {
    expect(parseMoneyInput(text, TWO)).toEqual({ ok: true, value })
  })

  test.each([['11,505'], ['11.5050'], ['11000.500'], ['1,5555']])(
    'refuses %j for more decimals than the business has, and says so',
    (text) => {
      expect(parseMoneyInput(text, TWO)).toEqual({ ok: false, tooManyDecimals: true })
    },
  )

  test.each([['1,234.5'], ['11,'], [',5'], ['1.2.3'], ['-5'], ['0'], ['0,00'], [''], ['$ 5'], ['1,2,3']])(
    'refuses %j as invalid, not as too many decimals',
    (text) => {
      expect(parseMoneyInput(text, TWO)).toEqual({ ok: false, tooManyDecimals: false })
    },
  )

  test('a dot and three digits is thousands, never decimals, even when the business keeps three', () => {
    expect(parseMoneyInput('11.500', { symbol: '$', decimals: 3 })).toEqual({ ok: true, value: 11500 })
    expect(parseMoneyInput('11.5', { symbol: '$', decimals: 3 })).toEqual({ ok: true, value: 11.5 })
  })
})

describe('moneyInputMode', () => {
  test('is digits only at 0 decimals and decimal-capable otherwise', () => {
    expect(moneyInputMode(ZERO)).toBe('numeric')
    expect(moneyInputMode(TWO)).toBe('decimal')
  })
})

describe('formatMoneyInput', () => {
  test('writes no thousands dots, a comma and exactly the business decimals', () => {
    expect(formatMoneyInput(11000, ZERO)).toBe('11000')
    expect(formatMoneyInput(11000, TWO)).toBe('11000,00')
    expect(formatMoneyInput(11000.5, TWO)).toBe('11000,50')
    expect(formatMoneyInput(1234567.89, TWO)).toBe('1234567,89')
  })

  test('parsing what it wrote gives the amount back, over the shared vectors at 0 and 2 decimals', () => {
    const rows = (vectors as { amount: string }[]).map((row) => row.amount)
    let checked = 0
    for (const decimals of [0, 2]) {
      const format = { symbol: '$', decimals }
      for (const amount of rows) {
        const [, fraction = ''] = amount.split('.')
        const value = Number(amount)
        if (value <= 0 || fraction.length > decimals || !Number.isSafeInteger(Math.round(value * 10 ** decimals))) continue
        expect(parseMoneyInput(formatMoneyInput(value, format), format)).toEqual({ ok: true, value })
        checked += 1
      }
    }
    expect(checked).toBeGreaterThan(10)
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
