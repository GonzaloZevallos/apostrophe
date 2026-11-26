/**
 * `unitCost`: the half-up cost of one gram from minor units and hundredths, null wherever
 * the arithmetic would leave safe integers. Both brands are built only by their constructors
 * (`toMinorUnits`, `parseQuantityInput`, `gramsToHundredths`).
 */

import { expect, test } from 'vitest'
import { parseMoneyInput, toMinorUnits } from '../format/parse'
import { costPerGram } from './costPerGram'
import vectors from './costPerGram.vectors.json'
import { gramsToHundredths, parseQuantityInput } from './stockUnit'
import { unitCost } from './unitCost'

/** The last cost whose numerator `2 * cost * 100 + q` is still a safe integer, for q = 100. */
const LAST_SAFE_COST = Math.floor((Number.MAX_SAFE_INTEGER - 100) / 200)

for (const vector of vectors) {
  test(`unit cost of ${vector.totalCost} over ${vector.grams} g agrees with costPerGram (${vector.expected})`, () => {
    expect(unitCost(toMinorUnits(vector.totalCost, 0), gramsToHundredths(vector.grams))).toBe(vector.expected)
    expect(costPerGram(vector.totalCost, gramsToHundredths(vector.grams))).toBe(vector.expected)
  })
}

test('the tie at 2 decimals: 1 minor unit over 2 g rounds up to 1', () => {
  expect(unitCost(toMinorUnits(0.01, 2), gramsToHundredths('2'))).toBe(1)
})

test('2 minor units over 5 g rounds down to 0 and is null', () => {
  expect(unitCost(toMinorUnits(0.02, 2), gramsToHundredths('5'))).toBeNull()
})

test('the last safe cost gives a number and one more is null', () => {
  const grams = gramsToHundredths('1')
  expect(unitCost(toMinorUnits(LAST_SAFE_COST, 0), grams)).toBe(LAST_SAFE_COST)
  expect(unitCost(toMinorUnits(LAST_SAFE_COST + 1, 0), grams)).toBeNull()
})

test('a quantity of zero or below is null', () => {
  const cost = toMinorUnits(1000, 0)
  expect(unitCost(cost, gramsToHundredths('0'))).toBeNull()
  expect(unitCost(cost, gramsToHundredths('-3,5'))).toBeNull()
  expect(unitCost(cost, gramsToHundredths('not grams'))).toBeNull()
})

test('a cost that is not a non-negative safe integer is null', () => {
  const grams = gramsToHundredths('1')
  expect(unitCost(toMinorUnits(-5, 0), grams)).toBeNull()
  expect(unitCost(toMinorUnits(Number.MAX_SAFE_INTEGER * 2, 0), grams)).toBeNull()
  expect(unitCost(toMinorUnits(Number.NaN, 0), grams)).toBeNull()
})

/** Typed money and typed grams through the parsers and constructors, as the form will. */
function unitCostOfTyped(money: string, decimals: number, grams: string): number | null {
  const cost = parseMoneyInput(money, { symbol: '$', decimals })
  const quantity = parseQuantityInput(grams)
  if (!cost.ok || quantity.kind !== 'value') throw new Error(`not typed amounts: ${money} / ${grams}`)
  return unitCost(toMinorUnits(cost.value, decimals), quantity.value)
}

test('end to end: 85.000 over 11,5 g at 0 decimals is 7391', () => {
  expect(unitCostOfTyped('85.000', 0, '11,5')).toBe(7391)
})

test('end to end: 85,50 over 11,5 g at 2 decimals is 743', () => {
  expect(unitCostOfTyped('85,50', 2, '11,5')).toBe(743)
})

test('end to end: 90.000.000.000.000 over 1 g is null', () => {
  expect(unitCostOfTyped('90.000.000.000.000', 0, '1')).toBeNull()
})
