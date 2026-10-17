/** `formatRowCost` (plain unit test): the one place an Análisis `RowCost` becomes text. */

import { expect, test } from 'vitest'
import { formatRowCost } from './analisisCost'

test('a fully pending figure reads only its grams, never a peso amount', () => {
  expect(formatRowCost({ amount: 0, pending_grams: 4, all_pending: true })).toBe('4 g not yet costed')
  expect(formatRowCost({ amount: 0, pending_grams: 2.5, all_pending: true })).toBe('2,5 g not yet costed')
})

test('a partly pending figure reads its amount and its own grams', () => {
  expect(formatRowCost({ amount: 9000, pending_grams: 2.5, all_pending: false })).toBe(
    '$ 9.000 and 2,5 g not yet costed',
  )
})

test('a fully costed figure reads its amount, and a real $0 reads $ 0', () => {
  expect(formatRowCost({ amount: 1500, pending_grams: 0, all_pending: false })).toBe('$ 1.500')
  expect(formatRowCost({ amount: 0, pending_grams: 0, all_pending: false })).toBe('$ 0')
})

test('it follows all_pending, not the amount: a costed $0 with pending grams keeps its $ 0', () => {
  expect(formatRowCost({ amount: 0, pending_grams: 1, all_pending: false })).toBe(
    '$ 0 and 1 g not yet costed',
  )
})
