import { afterEach, expect, test } from 'vitest'
import xa from '../copy/locales/en-XA/sales.json'
import { addFixtureNamespace, removeFixtureNamespace, testT, testTIn } from '../i18n/testing'
import { salesCount, salesOwingCount, segmentCount } from './counts'

afterEach(() => {
  removeFixtureNamespace('sales', 'en-XA')
})

test('zero reads "0 sales"', () => {
  expect(salesCount(testT, 0)).toBe('0 sales')
})

test('one reads "1 sale", singular', () => {
  expect(salesCount(testT, 1)).toBe('1 sale')
})

test('two or more read "N sales", plural', () => {
  expect(salesCount(testT, 2)).toBe('2 sales')
})

test('one owing sale reads "1 sale owing", singular', () => {
  expect(salesOwingCount(testT, 1)).toBe('1 sale owing')
})

test('several owing sales read "N sales owing", plural', () => {
  expect(salesOwingCount(testT, 4)).toBe('4 sales owing')
})

test('the wording comes from the active language file, not from the code', () => {
  addFixtureNamespace('sales', xa, 'en-XA')
  const out = salesCount(testTIn('en-XA'), 1)
  expect(out).toBe(xa.section.count_one.replace('{{count}}', '1'))
  expect(out).not.toBe('1 sale')
})

test.each([
  [0, '0'],
  [7, '7'],
  [999, '999'],
  [1000, '1.000'],
  [1234, '1.234'],
  [1234567, '1.234.567'],
])('segmentCount(%i) is the mark · and the figure %s', (n, figure) => {
  expect(segmentCount(n)).toEqual({ mark: '·', figure })
})
