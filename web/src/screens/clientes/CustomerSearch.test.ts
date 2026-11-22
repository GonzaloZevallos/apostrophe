/**
 * `typedQuery`, `listKeyQuery`, `customersListState`, `debtorsState` and `customersView`
 * (CustomerSearch.ts): the one decision of what Customers draws, read from which answers exist
 * and never from a count or an amount.
 */

import { describe, expect, test } from 'vitest'
import { debtorsOf } from '../../test/debtors'
import {
  customersListState,
  customersView,
  debtorsState,
  listKeyQuery,
  segmentCounts,
  typedQuery,
} from './CustomerSearch'

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

const BASE = { query: '', debtors: 'ready', segment: 'owed' } as const

test('a typed query is the flat list', () => {
  expect(customersView({ ...BASE, query: 'ana' })).toBe('flat')
})

test('a query of only spaces is not a typed query', () => {
  expect(customersView({ ...BASE, query: '   ' })).toBe('owed')
})

test('a cleared query is the held segment at once, with no flat moment', () => {
  expect(customersView({ ...BASE, query: '', segment: 'all' })).toBe('all')
  expect(customersView({ ...BASE, query: '', segment: 'owed' })).toBe('owed')
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

test('a query of only spaces is no query; any other is kept as typed', () => {
  expect(typedQuery('')).toBe('')
  expect(typedQuery('   ')).toBe('')
  expect(typedQuery('ni')).toBe('ni')
  expect(typedQuery(' ni ')).toBe(' ni ')
})

test('the list key follows the debounced value only while a query is typed', () => {
  expect(listKeyQuery('ni', 'ni')).toBe('ni')
  expect(listKeyQuery('nic', 'ni')).toBe('ni')
  expect(listKeyQuery('ni', '')).toBe('')
  expect(listKeyQuery('ni', '  ')).toBe('')
})

test('a cleared or spaces-only query keys the full list at once, whatever the debounced value is', () => {
  expect(listKeyQuery('', 'ni')).toBe('')
  expect(listKeyQuery('   ', 'ni')).toBe('')
})

const LIST = {
  typed: '',
  keyQuery: '',
  isPending: false,
  isPlaceholderData: false,
  isFetching: false,
  isError: false,
  isEmpty: false,
} as const

describe('customersListState with a typed query', () => {
  const TYPED = { ...LIST, typed: 'ni', keyQuery: 'ni' } as const

  test.each([
    ['the key still catching up to the typed query', { keyQuery: 'n' }],
    ['the key still catching up, with an empty answer', { keyQuery: 'n', isEmpty: true }],
    ['the first answer pending', { isPending: true }],
    ['placeholder data', { isPlaceholderData: true }],
    ['a fetch in flight', { isFetching: true }],
    ['placeholder data over an error', { isPlaceholderData: true, isError: true }],
  ])('is searching for %s', (_name, patch) => {
    expect(customersListState({ ...TYPED, ...patch })).toBe('searching')
  })

  test('is failed once the answer settled in error', () => {
    expect(customersListState({ ...TYPED, isError: true })).toBe('failed')
  })

  test('is no-match for a settled empty answer, and rows for a settled non-empty one', () => {
    expect(customersListState({ ...TYPED, isEmpty: true })).toBe('no-match')
    expect(customersListState(TYPED)).toBe('rows')
  })

  test('a failed answer is never no-match', () => {
    expect(customersListState({ ...TYPED, isError: true, isEmpty: true })).toBe('failed')
  })
})

describe('customersListState with no typed query', () => {
  test('is loading while the first answer is pending', () => {
    expect(customersListState({ ...LIST, isPending: true, isEmpty: true })).toBe('loading')
  })

  test('is failed on an error, empty on an empty answer and rows otherwise', () => {
    expect(customersListState({ ...LIST, isError: true })).toBe('failed')
    expect(customersListState({ ...LIST, isEmpty: true })).toBe('empty')
    expect(customersListState(LIST)).toBe('rows')
  })

  test('a cleared query never searches, even while the old key lingers', () => {
    expect(customersListState({ ...LIST, isFetching: true, isPlaceholderData: true })).toBe('rows')
  })
})
