import { expect, test } from 'vitest'
import { salesCount } from './counts'

test('zero reads "0 ventas"', () => {
  expect(salesCount(0)).toBe('0 ventas')
})

test('one reads "1 venta", singular', () => {
  expect(salesCount(1)).toBe('1 venta')
})

test('two or more read "N ventas", plural', () => {
  expect(salesCount(2)).toBe('2 ventas')
})
