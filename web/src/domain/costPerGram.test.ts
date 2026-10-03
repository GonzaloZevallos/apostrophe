/**
 * `costPerGram`, the front's mirror of `app/stock/domain/costing.cost_per_gram`, on
 * the same vectors as the backend's `tests/stock/test_costing.py` (plan, invariants:
 * "its front mirror tested on the shared vectors") — both sides must agree on the one
 * rounding rule stock shows a cost per gram with, including a half-cent remainder
 * (85.000 / 11,5 g) that a naive float division would round differently.
 */

import { expect, test } from 'vitest'
import { costPerGram, gramsToHundredths } from './costPerGram'
import vectors from './costPerGram.vectors.json'

for (const vector of vectors) {
  test(`cost per gram of $${vector.totalCost} over ${vector.grams} g is $${vector.expected}`, () => {
    expect(costPerGram(vector.totalCost, gramsToHundredths(vector.grams))).toBe(vector.expected)
  })
}

test('grams to hundredths keeps a two-decimal fraction exact, comma or dot', () => {
  expect(gramsToHundredths('11.5')).toBe(1150)
  expect(gramsToHundredths('11,5')).toBe(1150)
  expect(gramsToHundredths('30')).toBe(3000)
})
