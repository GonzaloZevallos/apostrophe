/** `parseShipping` at its own seam: zero is valid, blank and garbage are not. */

import { expect, test } from 'vitest'
import { parseShipping } from './shipping'

const TABLE: { name: string; input: string; decimals: number; expected: number | null }[] = [
  { name: 'blank, whole', input: '', decimals: 0, expected: null },
  { name: 'blank, cents', input: '', decimals: 2, expected: null },
  { name: "'0', whole", input: '0', decimals: 0, expected: 0 },
  { name: "'0', cents", input: '0', decimals: 2, expected: 0 },
  { name: "'0,00', whole", input: '0,00', decimals: 0, expected: null },
  { name: "'0,00', cents", input: '0,00', decimals: 2, expected: 0 },
  { name: 'a whole number, whole', input: '500', decimals: 0, expected: 500 },
  { name: 'a whole number, cents', input: '500', decimals: 2, expected: 500 },
  { name: 'a decimal, whole', input: '12,5', decimals: 0, expected: null },
  { name: 'a decimal, cents', input: '12,5', decimals: 2, expected: 12.5 },
  { name: 'garbage, whole', input: 'abc', decimals: 0, expected: null },
  { name: 'garbage, cents', input: 'abc', decimals: 2, expected: null },
]

test.each(TABLE)('$name', ({ input, decimals, expected }) => {
  expect(parseShipping(input, { symbol: '$', decimals })).toBe(expected)
})
