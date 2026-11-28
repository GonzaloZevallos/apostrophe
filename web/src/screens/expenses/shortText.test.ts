import { describe, expect, test } from 'vitest'
import { moneyFormatter } from '../../format/money'
import type { ShortAmount } from './expensesSummary'
import { shortText } from './shortText'

const rows: [string, ShortAmount, number, string][] = [
  ['a plain amount at 0 decimals', { unit: 'none', value: 950 }, 0, '$ 950'],
  ['a plain amount at 2 decimals', { unit: 'none', value: 999.5 }, 2, '$ 999,50'],
  ['a negative plain amount', { unit: 'none', value: -5 }, 0, '$ -5'],
  ['thousands', { unit: 'thousand', value: 90 }, 0, '$90k'],
  ['the most thousands', { unit: 'thousand', value: 999 }, 0, '$999k'],
  ['one million, with its decimal comma', { unit: 'million', value: 10 }, 0, '$1,0M'],
  ['millions with dot thousands', { unit: 'million', value: 12346 }, 0, '$1.234,6M'],
]

describe('shortText', () => {
  test.each(rows)('%s', (_name, short, decimals, expected) => {
    expect(shortText(short, moneyFormatter({ symbol: '$', decimals }))).toBe(expected)
  })

  test.each(rows)('%s, with the symbol US$', (_name, short, decimals, expected) => {
    expect(shortText(short, moneyFormatter({ symbol: 'US$', decimals }))).toBe(expected.replace('$', 'US$'))
  })
})
