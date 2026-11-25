/** `readSegment` / `withSegment`: the Products segment as the entry's history state carries it. */

import { expect, test } from 'vitest'
import { toast } from '../../components/feedback'
import { PRODUCTS_SEGMENTS } from '../../components/fixedSets'
import { findInAppLiterals, inAppState } from '../../components/inAppState'
import { DEFAULT_PRODUCTS_SEGMENT, readSegment, withSegment } from './productsSegment'
import sourceOfModule from './productsSegment.ts?raw'

const MODULE_PATH = 'src/screens/varieties/productsSegment.ts'

test('a state without the key reads as the default, catalog', () => {
  expect(DEFAULT_PRODUCTS_SEGMENT).toBe('catalog')
  expect(readSegment({})).toBe('catalog')
  expect(readSegment({ other: 'stock' })).toBe('catalog')
})

test.each([
  ['undefined', undefined],
  ['null', null],
  ['a string', 'stock'],
  ['a number', 3],
  ['an array', ['stock']],
  ['a Date', new Date(0)],
])('%s as state reads as the default', (_name, state) => {
  expect(readSegment(state)).toBe('catalog')
})

test.each([
  ['an unknown string', 'archive'],
  ['a different case', 'Stock'],
  ['a number', 1],
  ['an array', ['stock']],
  ['an object', { value: 'stock' }],
  ['null', null],
])('%s under the key reads as the default', (_name, value) => {
  expect(readSegment({ productsSegment: value })).toBe('catalog')
})

test('a valid value is read back, from a plain object or one with no prototype', () => {
  expect(readSegment({ productsSegment: 'stock' })).toBe('stock')
  expect(readSegment({ productsSegment: 'catalog' })).toBe('catalog')
  expect(readSegment(Object.assign(Object.create(null), { productsSegment: 'stock' }))).toBe('stock')
})

test('a value inherited from a prototype is not read', () => {
  expect(readSegment(Object.create({ productsSegment: 'stock' }))).toBe('catalog')
})

test('the values readSegment accepts are exactly those of PRODUCTS_SEGMENTS', () => {
  const values = PRODUCTS_SEGMENTS.map((option) => option.value)
  expect(values).toEqual(['catalog', 'stock'])
  for (const value of values) expect(readSegment({ productsSegment: value })).toBe(value)
  expect(readSegment({ productsSegment: 'other' })).toBe(DEFAULT_PRODUCTS_SEGMENT)
})

test('withSegment keeps inApp, from and the feedback key, and sets the segment', () => {
  const state = inAppState({ pathname: '/products' }, toast('common:customerSaved'))
  const before = structuredClone(state)

  const next = withSegment(state, 'stock')

  expect(next).toEqual({ ...before, productsSegment: 'stock' })
  expect(readSegment(next)).toBe('stock')
  expect(state).toEqual(before)
  expect(next).not.toBe(state)
})

test('withSegment replaces an earlier segment without touching the rest', () => {
  expect(withSegment({ productsSegment: 'stock', keep: 1 }, 'catalog')).toEqual({
    productsSegment: 'catalog',
    keep: 1,
  })
})

test.each([
  ['null', null],
  ['undefined', undefined],
  ['an array', ['a', 'b']],
  ['a Date', new Date(0)],
  ['a string', 'text'],
  ['a number', 4],
])('withSegment on %s as state gives the segment alone', (_name, state) => {
  expect(withSegment(state, 'stock')).toEqual({ productsSegment: 'stock' })
})

test('withSegment never writes inApp or from itself', () => {
  expect(Object.keys(withSegment(null, 'catalog'))).toEqual(['productsSegment'])
  expect(Object.keys(withSegment({}, 'catalog'))).toEqual(['productsSegment'])
})

test('the module writes no in-app marker by hand, and the scan rejects a source that does', () => {
  expect(findInAppLiterals([{ path: MODULE_PATH, content: sourceOfModule }])).toEqual([])
  const handWritten = `${sourceOfModule}\nconst bad = { ${'inApp'}: ${'true'} }`
  expect(findInAppLiterals([{ path: MODULE_PATH, content: handWritten }])).toEqual([MODULE_PATH])
})
