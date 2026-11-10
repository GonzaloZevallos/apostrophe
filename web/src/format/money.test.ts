import { afterEach, describe, expect, test } from 'vitest'
import {
  formatGrams,
  formatGramsInput,
  formatMoney,
  formatMoneyMagnitude,
  formatQuantity,
  formatSignedMoney,
  currentMoneyFormat,
  keepMoneyTogether,
  resetMoneyFormat,
  setMoneyFormat,
} from './money'

afterEach(() => {
  resetMoneyFormat()
})

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

  test('the format is $ and 0 decimals until one is set', () => {
    expect(currentMoneyFormat()).toEqual({ symbol: '$', decimals: 0 })
  })
})

describe('formatMoney at the Business format', () => {
  test.each([
    ['$', 0, 11000, '$ 11.000'],
    ['$', 0, 0, '$ 0'],
    ['US$', 0, 11000, 'US$ 11.000'],
    ['US$', 1, 11000.5, 'US$ 11.000,5'],
    ['US$', 1, 11000, 'US$ 11.000,0'],
    ['US$', 2, 11000.5, 'US$ 11.000,50'],
    ['US$', 2, 11000, 'US$ 11.000,00'],
    ['R$', 2, 0.05, 'R$ 0,05'],
    ['R$', 2, 1234567.89, 'R$ 1.234.567,89'],
    ['1 $', 2, 1500, '1 $ 1.500,00'],
    ['(*)', 2, 999.995, '(*) 1.000,00'],
    ['US$', 2, -0.001, 'US$ 0,00'],
  ])('symbol %s, %i decimals: %f reads %s', (symbol, decimals, amount, expected) => {
    setMoneyFormat({ symbol, decimals })
    expect(formatMoney(amount)).toBe(expected)
  })

  test('the magnitude and signed forms follow the same format', () => {
    setMoneyFormat({ symbol: 'US$', decimals: 2 })
    expect(formatMoneyMagnitude(-2000.5)).toBe('US$ 2.000,50')
    expect(formatSignedMoney(-4500.25)).toBe('−US$ 4.500,25')
    expect(formatSignedMoney(4500)).toBe('US$ 4.500,00')
    expect(formatSignedMoney(-0.001)).toBe('US$ 0,00')
  })

  test('setMoneyFormat keeps its own copy of what it was given', () => {
    const given = { symbol: 'US$', decimals: 2 }
    setMoneyFormat(given)
    given.symbol = 'X'
    expect(currentMoneyFormat().symbol).toBe('US$')
  })
})

describe('keepMoneyTogether', () => {
  test.each([
    ['$', 0, 'Costs $ 11.000 today', 'Costs $\u00a011.000 today'],
    ['US$', 2, 'Costs US$ 11.000,50 or US$ 5,00', 'Costs US$\u00a011.000,50 or US$\u00a05,00'],
    ['R$', 1, 'R$ 3,5', 'R$\u00a03,5'],
    ['1 $', 2, 'Pay 1 $ 20,00 now', 'Pay 1 $\u00a020,00 now'],
    ['(*)', 2, 'Pay (*) 20,00 now', 'Pay (*)\u00a020,00 now'],
  ])('symbol %s joins the figure: %s', (symbol, decimals, text, expected) => {
    setMoneyFormat({ symbol, decimals })
    expect(keepMoneyTogether(text)).toBe(expected)
  })

  test('a symbol with regex metacharacters matches only itself', () => {
    setMoneyFormat({ symbol: '(*)', decimals: 0 })
    expect(keepMoneyTogether('a * 5 and $ 5 and (*) 5')).toBe('a * 5 and $ 5 and (*)\u00a05')
  })

  test('a dollar sign in the symbol is not read as a replacement pattern', () => {
    setMoneyFormat({ symbol: '$&', decimals: 0 })
    expect(keepMoneyTogether('$& 5')).toBe('$&\u00a05')
  })

  test('a symbol with no digit after it is left alone', () => {
    setMoneyFormat({ symbol: 'US$', decimals: 0 })
    expect(keepMoneyTogether('US$ is the symbol')).toBe('US$ is the symbol')
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
