/**
 * `debtorsState` and `customersView` (CustomerSearch.ts): the one decision of what Customers
 * draws, read from which answers exist and never from a count or an amount.
 */

import { expect, test } from 'vitest'
import { debtorsOf } from '../../test/debtors'
import { customersView, debtorsState, segmentCounts } from './CustomerSearch'

const DATA = debtorsOf()

test('no data and no error is pending', () => {
  expect(debtorsState({ data: undefined, isError: false })).toBe('pending')
})

test('data present is ready', () => {
  expect(debtorsState({ data: DATA, isError: false })).toBe('ready')
})

test('data present after a failed refetch stays ready', () => {
  expect(debtorsState({ data: DATA, isError: true })).toBe('ready')
})

test('no data and an error is failed', () => {
  expect(debtorsState({ data: undefined, isError: true })).toBe('failed')
})

const BASE = { query: '', isPlaceholderData: false, debtors: 'ready', segment: 'owed' } as const

test('a typed query is the flat list', () => {
  expect(customersView({ ...BASE, query: 'ana' })).toBe('flat')
})

test('the cleared-query placeholder window is the flat list', () => {
  expect(customersView({ ...BASE, isPlaceholderData: true })).toBe('flat')
})

test('a failed debtors read is the flat list', () => {
  expect(customersView({ ...BASE, debtors: 'failed' })).toBe('flat')
})

test('otherwise the view is the selected segment, even while the debtors read is pending', () => {
  expect(customersView(BASE)).toBe('owed')
  expect(customersView({ ...BASE, segment: 'all' })).toBe('all')
  expect(customersView({ ...BASE, debtors: 'pending', segment: 'all' })).toBe('all')
})

test('segment counts come from the answer, and a missing answer is the skeleton', () => {
  expect(segmentCounts(debtorsOf({ customer_count: 38, debtor_count: 6 }))).toEqual({
    customerCount: 38,
    debtorCount: 6,
    pending: false,
  })
  expect(segmentCounts(undefined).pending).toBe(true)
})
