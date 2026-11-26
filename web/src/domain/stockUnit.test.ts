/**
 * The stock quantity rules: grams typed as text become integer hundredths (and back)
 * on digit strings, never by multiplying a parsed float.
 */

import { expect, test } from 'vitest'
import { formatQuantityInput, gramsToHundredths, parseQuantityInput, STOCK_UNIT, type Hundredths } from './stockUnit'

test.each([
  ['-3,5', -350],
  ['-0,5', -50],
  ['0,05', 5],
  ['-0,05', -5],
  ['30', 3000],
  ['11.5', 1150],
  ['11,5', 1150],
])('gramsToHundredths(%j) is %d', (text, expected) => {
  expect(gramsToHundredths(text)).toBe(expected)
})

test('the stock unit is the gram label, kept to two decimals', () => {
  expect(STOCK_UNIT).toEqual({ labelKey: 'unit', decimals: 2 })
})

test.each([
  [350, '3,5'],
  [405, '4,05'],
  [-50, '-0,5'],
  [100000, '1000'],
  [5, '0,05'],
  [-5, '-0,05'],
  [100, '1'],
  [1150, '11,5'],
])('formatQuantityInput(%d) is %j', (hundredths, expected) => {
  expect(formatQuantityInput(hundredthsOf(hundredths))).toBe(expected)
})

/** A `Hundredths` through the parser, the only way a test makes one. */
function hundredthsOf(value: number): Hundredths {
  const parsed = parseQuantityInput(formatPlain(value))
  if (parsed.kind !== 'value') throw new Error(`not a quantity: ${value}`)
  return parsed.value
}

/** `value` hundredths as typed text, by string arithmetic (not `formatQuantityInput`). */
function formatPlain(value: number): string {
  const digits = String(Math.abs(value)).padStart(3, '0')
  return `${value < 0 ? '-' : ''}${digits.slice(0, -2)},${digits.slice(-2)}`
}

test('parse(format(h)) is h for every h in -100000..100000 and next to the safe-integer limit', () => {
  const sweep = [Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER]
  for (let h = -100000; h <= 100000; h += 1) sweep.push(h)
  for (const h of sweep) {
    if (h === 0) continue
    const first = hundredthsOf(h)
    const parsed = parseQuantityInput(formatQuantityInput(first))
    expect(parsed).toEqual({ kind: 'value', value: h })
  }
})

test('the safe-integer limit is typed as 90071992547409,91 and one more hundredth is refused', () => {
  expect(parseQuantityInput('90071992547409,91')).toEqual({ kind: 'value', value: 9007199254740991 })
  expect(parseQuantityInput('-90071992547409,91')).toEqual({ kind: 'value', value: -9007199254740991 })
  expect(parseQuantityInput('90071992547409,92')).toEqual({ kind: 'invalid' })
  expect(parseQuantityInput('-90071992547409,92')).toEqual({ kind: 'invalid' })
  expect(parseQuantityInput('900719925474099999')).toEqual({ kind: 'invalid' })
})

test('3,50 and 3.5 both format back to 3,5', () => {
  for (const text of ['3,50', '3.5']) {
    const parsed = parseQuantityInput(text)
    expect(parsed.kind).toBe('value')
    if (parsed.kind === 'value') expect(formatQuantityInput(parsed.value)).toBe('3,5')
  }
})

test.each(['', '   ', '\t'])('blank text %j is empty', (text) => {
  expect(parseQuantityInput(text)).toEqual({ kind: 'empty' })
})

test.each([
  ['-,5'],
  ['3,'],
  ['1.000'],
  ['0'],
  ['0,00'],
  ['-0'],
  ['-0,00'],
  ['3,456'],
  ['1,2,3'],
  ['abc'],
  ['--3'],
  ['+3'],
  ['3 5'],
])('%j is invalid', (text) => {
  expect(parseQuantityInput(text)).toEqual({ kind: 'invalid' })
})

test.each([
  ['00,5', 50],
  [' 3,5 ', 350],
  ['-0,05', -5],
  ['0,05', 5],
  ['1.5', 150],
])('%j parses to %d', (text, expected) => {
  expect(parseQuantityInput(text)).toEqual({ kind: 'value', value: expected })
})
