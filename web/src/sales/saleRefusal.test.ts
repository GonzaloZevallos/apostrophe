/** `isMethodUnavailable`: the one place that recognises the method-archived refusal. */

import { expect, test } from 'vitest'
import { ApiError, NetworkError, UNKNOWN_CODE } from '../api/client'
import { isMethodUnavailable } from './saleRefusal'

test('is true only for the payment_method.unavailable refusal', () => {
  expect(isMethodUnavailable(new ApiError(404, 'payment_method.unavailable'))).toBe(true)
})

test('is false for another refusal code, the unknown code, a network failure and a plain error', () => {
  expect(isMethodUnavailable(new ApiError(422, 'sale.payment_required'))).toBe(false)
  expect(isMethodUnavailable(new ApiError(500, UNKNOWN_CODE))).toBe(false)
  expect(isMethodUnavailable(new NetworkError())).toBe(false)
  expect(isMethodUnavailable(new Error('payment_method.unavailable'))).toBe(false)
  expect(isMethodUnavailable('payment_method.unavailable')).toBe(false)
})
