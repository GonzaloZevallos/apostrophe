/** `undoOutcome` at the pure seam: one case per branch of the rule that picks what Undo shows. */

import { expect, test } from 'vitest'
import { ApiError, NetworkError } from '../api/client'
import { undoOutcome } from './useUndoSale'

test('a 401 shows nothing: the session boundary owns it', () => {
  expect(undoOutcome(new ApiError(401, 'auth.unauthorized'))).toBeNull()
})

test('a network error is offline', () => {
  expect(undoOutcome(new NetworkError())).toBe('offline')
})

test('a 404 sale.not_found is gone', () => {
  expect(undoOutcome(new ApiError(404, 'sale.not_found'))).toBe('gone')
})

test('a refusal with another code is failed', () => {
  expect(undoOutcome(new ApiError(409, 'sale.not_deletable'))).toBe('failed')
})

test('a 500 with an unknown code is failed', () => {
  expect(undoOutcome(new ApiError(500, 'internal'))).toBe('failed')
})

test('a plain Error is failed', () => {
  expect(undoOutcome(new Error('boom'))).toBe('failed')
})
