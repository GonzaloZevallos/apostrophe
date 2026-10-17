/**
 * The formats the English app keeps (ADR-0048): only the words inside a figure change, never
 * its numbers or symbols. This pins every one of them in one place; the screens' own tests
 * pin the words around them.
 */

import { expect, test } from 'vitest'
import { WEEKDAY_SHORT } from '../copy/format'
import { chipDate, formatDate, formatDateShort, formatMonthLong, sinceWhen } from './dates'
import { amountAndPending, pendingOnly, pendingSuffix } from './pending'
import { formatGrams, formatMoney, formatSignedMoney } from './money'
import { salesCount } from './counts'

test('money stays whole pesos with a dot for thousands, a minus sign before the symbol', () => {
  expect(formatMoney(11000)).toBe('$ 11.000')
  expect(formatSignedMoney(-4500)).toBe('−$ 4.500')
})

test('grams keep a comma and up to two decimals', () => {
  expect(formatGrams(3.5)).toBe('3,5 g')
})

test('dates stay dd/mm, with the year only when it differs from today', () => {
  expect(formatDateShort('2026-10-07')).toBe('07/10')
  expect(formatDate('2026-10-07', '2026-10-15')).toBe('07/10')
  expect(formatDate('2025-12-14', '2026-10-15')).toBe('14/12/2025')
})

test('today reads "Today dd/mm" and any other day only dd/mm', () => {
  expect(chipDate('2026-10-07', '2026-10-07')).toBe('Today 07/10')
  expect(chipDate('2026-10-02', '2026-10-07')).toBe('02/10')
})

test('a price effective from a date reads "since dd/mm"', () => {
  expect(sinceWhen('2026-09-12', '2026-10-02')).toBe('since 12/09')
})

test('months are named in English with their year', () => {
  expect(formatMonthLong('2026-10')).toBe('October 2026')
})

test('a figure with grams not yet costed says so after its amount, or alone when all of it is pending', () => {
  expect(amountAndPending(9000, 2.5)).toBe('$ 9.000 and 2,5 g not yet costed')
  expect(pendingOnly(4)).toBe('4 g not yet costed')
  expect(pendingSuffix(2.5)).toBe(' and 2,5 g not yet costed')
  expect(pendingSuffix(0)).toBe('')
})

test('weekdays are three English letters, Monday first', () => {
  expect([...WEEKDAY_SHORT]).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
})

test('a sales count reads "1 sale" and "N sales"', () => {
  expect(salesCount(0)).toBe('0 sales')
  expect(salesCount(1)).toBe('1 sale')
  expect(salesCount(2)).toBe('2 sales')
})
