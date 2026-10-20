import { expect, test } from 'vitest'
import { salesCount, salesOwingCount } from './counts'

test('zero reads "0 ventas"', () => {
  expect(salesCount(0)).toBe('0 ventas')
})

test('one reads "1 venta", singular', () => {
  expect(salesCount(1)).toBe('1 venta')
})

test('two or more read "N ventas", plural', () => {
  expect(salesCount(2)).toBe('2 ventas')
})

test('one owing sale reads "1 venta debiendo", singular', () => {
  expect(salesOwingCount(1)).toBe('1 venta debiendo')
})

test('several owing sales read "N ventas debiendo", plural', () => {
  expect(salesOwingCount(4)).toBe('4 ventas debiendo')
})
