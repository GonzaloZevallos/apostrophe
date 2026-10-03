/**
 * `readFeedback` at the module seam: a closed union of toast strings and the
 * fixed gone notice, never an arbitrary string trusted off `location.state`
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
} from './feedback'

test('accepts a toast from the closed set', () => {
  expect(readFeedback({ toast: 'Cliente guardado' })).toEqual({
    kind: 'toast',
    message: 'Cliente guardado',
  })
})

test('accepts "Venta eliminada · los gramos vuelven al stock", added to the closed set for Borrar venta and Deshacer', () => {
  expect(readFeedback({ toast: 'Venta eliminada · los gramos vuelven al stock' })).toEqual({
    kind: 'toast',
    message: 'Venta eliminada · los gramos vuelven al stock',
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

test('saleJustSaved writes a marker readFeedback turns into the "saved" kind', () => {
  expect(readFeedback(saleJustSaved())).toEqual({ kind: 'saved', message: SALE_SAVED })
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
