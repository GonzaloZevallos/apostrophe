/**
 * `readFeedback` at the module seam: a closed union of toast strings and the
 * fixed gone notice, never an arbitrary string trusted off `location.state`
 * (open review finding: a `Notice` that renders any string it is handed).
 */

import { expect, test } from 'vitest'
import { GONE_NOTICE } from '../api/refusals'
import { readFeedback } from './feedback'

test('accepts a toast from the closed set', () => {
  expect(readFeedback({ toast: 'Cliente guardado' })).toEqual({
    kind: 'toast',
    message: 'Cliente guardado',
  })
})

test('accepts the fixed gone notice', () => {
  expect(readFeedback({ notice: GONE_NOTICE })).toEqual({ kind: 'notice', message: GONE_NOTICE })
})

test('rejects a toast string outside the closed set — never renders an arbitrary message', () => {
  expect(readFeedback({ toast: 'Cliente eliminado' })).toBeNull()
})

test('rejects a notice that is not the fixed gone text', () => {
  expect(readFeedback({ notice: 'cualquier cosa' })).toBeNull()
})

test('rejects a state with neither key, and a non-object state', () => {
  expect(readFeedback({})).toBeNull()
  expect(readFeedback(null)).toBeNull()
  expect(readFeedback('Cliente guardado')).toBeNull()
})
