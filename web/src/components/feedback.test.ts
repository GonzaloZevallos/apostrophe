/**
 * `readFeedback` at the module seam: a closed union of `common:` toast keys and the
 * fixed gone notice, never an arbitrary value trusted off `location.state`
 * (open review finding: a `Notice` that renders any string it is handed).
 */

import { expect, test } from 'vitest'
import { GONE_NOTICE } from '../api/refusals'
import {
  clearSaleJustSaved,
  newSaleFor,
  readFeedback,
  readNewSaleState,
  SALE_SAVED,
  saleJustSaved,
  TOAST_MESSAGES,
  toast,
} from './feedback'

const TOAST_KEYS = [
  'common:customerSaved',
  'common:saleDeleted',
  'common:saleDeletedGramsBack',
  'common:entrySaved',
  'common:entryDeleted',
] as const

test.each(TOAST_KEYS)('round-trips the toast key %s through toast() and readFeedback', (key) => {
  expect(readFeedback(toast(key))).toEqual({ kind: 'toast', key })
})

test('the closed set is exactly the five success keys', () => {
  expect([...TOAST_MESSAGES]).toEqual([...TOAST_KEYS])
})

test.each([
  ['an English toast word', { toast: 'Customer saved' }],
  ['an unknown key', { toast: 'common:notAKey' }],
  ['a key from another namespace', { toast: 'refusals:goneNotice' }],
  ['a number', { toast: 7 }],
  ['null', { toast: null }],
  ['a malformed object', { toast: { key: 'common:customerSaved' } }],
  ['the saved key as a toast', { toast: SALE_SAVED }],
  ['a notice that is not the gone text', { notice: 'cualquier cosa' }],
  ['a notice that is a key', { notice: 'common:customerSaved' }],
])('readFeedback yields null for %s, without throwing', (_name, state) => {
  expect(() => readFeedback(state)).not.toThrow()
  expect(readFeedback(state)).toBeNull()
})

// The gone text is the one English value accepted from history state until part 3 moves it to
// `refusals:goneNotice`; a stale English toast, by contrast, renders nothing (intended).
test('accepts the fixed gone notice', () => {
  expect(readFeedback({ notice: GONE_NOTICE })).toEqual({ kind: 'notice', message: GONE_NOTICE })
})

test('rejects a state with neither key, and a non-object state', () => {
  expect(readFeedback({})).toBeNull()
  expect(readFeedback(null)).toBeNull()
  expect(readFeedback(7)).toBeNull()
  expect(readFeedback('common:customerSaved')).toBeNull()
})

test('saleJustSaved writes a marker readFeedback turns into the "saved" kind', () => {
  expect(readFeedback(saleJustSaved())).toEqual({ kind: 'saved', key: SALE_SAVED })
})

test('rejects a falsy or wrongly-typed "just saved" marker — never shows Deshacer from a guess', () => {
  expect(readFeedback({ saleJustSaved: false })).toBeNull()
  expect(readFeedback({ saleJustSaved: 'true' })).toBeNull()
})

test('clearSaleJustSaved is state readFeedback no longer recognises', () => {
  expect(readFeedback(clearSaleJustSaved())).toBeNull()
})

test('newSaleFor carries only the customer id, which readNewSaleState reads back', () => {
  const state = newSaleFor('cust-1')
  expect(state).toEqual({ customerId: 'cust-1' })
  expect(readNewSaleState(state)).toBe('cust-1')
})

test('readNewSaleState rejects a missing, empty, non-string or absent-object id', () => {
  expect(readNewSaleState({})).toBeNull()
  expect(readNewSaleState({ customerId: '' })).toBeNull()
  expect(readNewSaleState({ customerId: 42 })).toBeNull()
  expect(readNewSaleState(null)).toBeNull()
  expect(readNewSaleState('cust-1')).toBeNull()
})
