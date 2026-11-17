/** `tooManyDecimalsMessage(format)` follows the business's decimals, and so do the tables built on it. */

import { expect, test } from 'vitest'
import { fieldOfCode } from '../screens/varieties/priceFieldRules'
import { tooManyDecimalsMessage } from './amountRefusal'

test('0 decimals asks for whole amounts, any other count names itself', () => {
  expect(tooManyDecimalsMessage({ symbol: '$', decimals: 0 })).toBe('Use whole amounts only.')
  expect(tooManyDecimalsMessage({ symbol: 'US$', decimals: 2 })).toBe('Use up to 2 decimals.')
  expect(tooManyDecimalsMessage({ symbol: 'BD', decimals: 3 })).toBe('Use up to 3 decimals.')
})

test('the price form maps the decimals refusal to the list price with the business decimals', () => {
  expect(fieldOfCode('money.too_many_decimals', { symbol: '$', decimals: 0 })).toEqual({
    field: 'listPrice',
    message: 'Use whole amounts only.',
  })
  expect(fieldOfCode('money.too_many_decimals', { symbol: 'US$', decimals: 2 })).toEqual({
    field: 'listPrice',
    message: 'Use up to 2 decimals.',
  })
})
