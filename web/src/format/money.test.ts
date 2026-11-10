import { describe, expect, test } from 'vitest'
import {
  formatGrams,
  formatGramsInput,
  formatMoney,
  formatMoneyMagnitude,
  formatQuantity,
  formatSignedMoney,
  MONEY_DECIMALS,
} from './money'

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

  test('a JSON number that is not whole is shown at the display decimals, half away from zero', () => {
    expect(formatMoney(11000.5)).toBe('$ 11.001')
    expect(formatMoney(11000.49)).toBe('$ 11.000')
    expect(formatMoney(0.25)).toBe('$ 0')
    expect(formatMoney(-0.25)).toBe('$ 0')
  })

  test('a whole amount reads the same as before', () => {
    expect(formatMoney(1)).toBe('$ 1')
    expect(formatMoney(999999)).toBe('$ 999.999')
  })

  test('the display decimals are 0 today', () => {
    expect(MONEY_DECIMALS).toBe(0)
  })
})

describe('the signed and magnitude forms with a figure that is not whole', () => {
  test('a negative half rounds away from zero', () => {
    expect(formatSignedMoney(-4500.5)).toBe('−$ 4.501')
    expect(formatMoneyMagnitude(-2000.5)).toBe('$ 2.001')
  })

  test('a negative figure that rounds to zero shows no minus sign', () => {
    expect(formatSignedMoney(-0.4)).toBe('$ 0')
  })
})

describe('formatMoneyMagnitude', () => {
  test('a credit (negative) balance shows as its magnitude, with no minus sign', () => {
    expect(formatMoneyMagnitude(-2000)).toBe('$ 2.000')
  })

  test('a positive balance formats the same as formatMoney', () => {
    expect(formatMoneyMagnitude(15000)).toBe('$ 15.000')
  })
})

describe('formatSignedMoney', () => {
  test('a negative amount gives U+2212 and its magnitude', () => {
    expect(formatSignedMoney(-4500)).toBe('−$ 4.500')
  })

  test('zero carries no sign', () => {
    expect(formatSignedMoney(0)).toBe('$ 0')
  })

  test('a positive amount formats the same as formatMoney', () => {
    expect(formatSignedMoney(4500)).toBe('$ 4.500')
  })

  test('a negative single peso still carries the sign', () => {
    expect(formatSignedMoney(-1)).toBe('−$ 1')
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

describe('formatGramsInput', () => {
  test('a field shows the comma, no unit and no thousands dot', () => {
    expect(formatGramsInput(18.5)).toBe('18,5')
    expect(formatGramsInput(1500)).toBe('1500')
  })
})

describe('formatQuantity', () => {
  test.each([
    [1, '0,01'],
    [10, '0,1'],
    [105, '1,05'],
    [350, '3,5'],
    [100000, '1.000'],
    [0, '0'],
    [123456789, '1.234.567,89'],
  ])('%i hundredths read %s', (hundredths, expected) => {
    expect(formatQuantity(hundredths)).toBe(expected)
  })
})
