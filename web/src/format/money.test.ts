import { describe, expect, test } from 'vitest'
import {
  formatGrams,
  formatGramsInput,
  formatMoney,
  formatMoneyMagnitude,
  formatQuantity,
  formatSignedMoney,
  moneyFormatter,
} from './money'
import vectors from './money.vectors.json'

interface Vector {
  amount: string
  decimals: number
  symbol: string
  spaced: string
  attached: string | null
  signed: string
}

describe('moneyFormatter over money.vectors.json', () => {
  const rows: Vector[] = vectors
  const id = (row: Vector): string => `${row.symbol} ${row.amount} at ${row.decimals}`

  test.each(rows)('$symbol $amount at $decimals decimals writes the spaced and the signed form', (row) => {
    const money = moneyFormatter({ symbol: row.symbol, decimals: row.decimals })
    expect(money.magnitude(row.amount), id(row)).toBe(row.spaced)
    expect(money.signed(row.amount), id(row)).toBe(row.signed)
    if (!row.amount.startsWith('-')) expect(money.money(row.amount), id(row)).toBe(row.spaced)
  })

  test.each(rows.filter((row) => row.attached !== null))(
    '$symbol $amount at $decimals decimals writes the attached form',
    (row) => {
      expect(moneyFormatter({ symbol: row.symbol, decimals: row.decimals }).attached(row.amount)).toBe(row.attached)
    },
  )

  test('a JSON number gives the same text as its decimal string', () => {
    const money = moneyFormatter({ symbol: '$', decimals: 2 })
    expect(money.money(1.005)).toBe('$ 1,01')
    expect(money.money(11000.5)).toBe('$ 11.000,50')
    expect(money.money(1e21)).toBe('$ 1.000.000.000.000.000.000.000,00')
    expect(money.money(0.0000001)).toBe('$ 0,00')
  })

  test('a "$" business with 0 decimals reads $ 11.000 byte for byte as formatMoney does', () => {
    const money = moneyFormatter({ symbol: '$', decimals: 0 })
    for (const pesos of [0, 1, 500, 999999, 11000, 1234567, 10999.6, 11000.5]) {
      expect(money.money(pesos)).toBe(formatMoney(pesos))
    }
    expect(money.signed(-4500)).toBe(formatSignedMoney(-4500))
    expect(money.magnitude(-2000)).toBe(formatMoneyMagnitude(-2000))
  })

  test('a negative figure that rounds to zero shows no minus sign', () => {
    const money = moneyFormatter({ symbol: 'US$', decimals: 0 })
    expect(money.money(-0.4)).toBe('US$ 0')
    expect(money.signed(-0.4)).toBe('US$ 0')
  })

  test('a symbol with regular-expression characters is kept together literally', () => {
    const money = moneyFormatter({ symbol: 'R$', decimals: 2 })
    expect(money.keepTogether('Pay R$ 5,00 or $ 5 now')).toBe('Pay R$\u00a05,00 or $ 5 now')
    expect(moneyFormatter({ symbol: '$', decimals: 0 }).keepTogether('A $ 5 and a $ x')).toBe('A $\u00a05 and a $ x')
    expect(moneyFormatter({ symbol: '$&', decimals: 0 }).keepTogether('a $& 5')).toBe('a $&\u00a05')
  })

  test('something that is not an amount is refused', () => {
    expect(() => moneyFormatter({ symbol: '$', decimals: 0 }).money('abc')).toThrow('Not an amount: abc')
  })
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
