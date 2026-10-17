import { expect, test } from 'vitest'
import { salesCount } from './counts'

test('zero reads "0 sales"', () => {
  expect(salesCount(0)).toBe('0 sales')
})

test('one reads "1 sale", singular', () => {
  expect(salesCount(1)).toBe('1 sale')
})

test('two or more read "N sales", plural', () => {
  expect(salesCount(2)).toBe('2 sales')
})
