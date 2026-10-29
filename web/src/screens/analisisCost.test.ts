/** `rowCostParts` / `amountParts` (plain unit test): the one place an Análisis `RowCost` becomes text. */

import { expect, test } from 'vitest'
import { amountParts, rowCostParts } from './analisisCost'

test('a fully pending figure has no amount, only its grams as the marker', () => {
  expect(rowCostParts({ amount: 0, pending_quantity: 4, all_pending: true })).toEqual({
    amount: null,
    marker: '4 g without cost',
  })
  expect(rowCostParts({ amount: 0, pending_quantity: 2.5, all_pending: true })).toEqual({
    amount: null,
    marker: '2,5 g without cost',
  })
})

test('a partly pending figure has its amount and a marker with its own grams', () => {
  expect(rowCostParts({ amount: 9000, pending_quantity: 2.5, all_pending: false })).toEqual({
    amount: '$ 9.000',
    marker: ' and 2,5 g without cost',
  })
})

test('a fully costed figure has its amount and no marker, and a real $0 keeps its $ 0', () => {
  expect(rowCostParts({ amount: 1500, pending_quantity: 0, all_pending: false })).toEqual({
    amount: '$ 1.500',
    marker: '',
  })
  expect(rowCostParts({ amount: 0, pending_quantity: 0, all_pending: false })).toEqual({
    amount: '$ 0',
    marker: '',
  })
})

test('it follows all_pending, not the amount: a costed $0 with pending grams keeps its $ 0', () => {
  expect(rowCostParts({ amount: 0, pending_quantity: 1, all_pending: false })).toEqual({
    amount: '$ 0',
    marker: ' and 1 g without cost',
  })
})

test('amountParts marks a plain amount only when grams are pending', () => {
  expect(amountParts(236500, 0)).toEqual({ amount: '$ 236.500', marker: '' })
  expect(amountParts(236500, 1)).toEqual({ amount: '$ 236.500', marker: ' and 1 g without cost' })
})
