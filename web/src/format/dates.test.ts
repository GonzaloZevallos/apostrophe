import { describe, expect, test } from 'vitest'
import {
  formatDate,
  formatDateLong,
  formatDateShort,
  formatMonthLong,
  maxSaleDate,
  monthRange,
  parseMonth,
  shiftMonth,
  sinceWhen,
  todayRange,
  weekRange,
} from './dates'

describe('formatDate', () => {
  test('drops the year when it matches today\'s', () => {
    expect(formatDate('2026-10-02', '2026-10-02')).toBe('02/10')
  })

  test('keeps the year when it differs from today\'s', () => {
    expect(formatDate('2025-12-14', '2026-10-02')).toBe('14/12/2025')
  })

  test('rejects a string that is not an API date', () => {
    expect(() => formatDate('02/10/2026', '2026-10-02')).toThrow()
  })
})

describe('formatDateShort', () => {
  test('always drops the year, with no "today" to compare against', () => {
    expect(formatDateShort('2026-10-09')).toBe('09/10')
  })

  test('rejects a string that is not an API date', () => {
    expect(() => formatDateShort('2026-10-09T00:00:00Z')).toThrow()
  })
})

describe('formatDateLong', () => {
  test('always carries the year', () => {
    expect(formatDateLong('2026-09-12')).toBe('12/09/2026')
  })
})

describe('sinceWhen', () => {
  test('wraps formatDate for a price\'s "Rige desde"', () => {
    expect(sinceWhen('2026-09-12', '2026-10-02')).toBe('desde el 12/09')
  })
})

describe('formatMonthLong', () => {
  test('names the month in Spanish, with its year', () => {
    expect(formatMonthLong('2026-10')).toBe('Octubre 2026')
  })

  test('rejects a string that is not an API month', () => {
    expect(() => formatMonthLong('2026-13')).toThrow()
  })
})

describe('shiftMonth', () => {
  test('moves forward within the same year', () => {
    expect(shiftMonth('2026-10', 1)).toBe('2026-11')
  })

  test('moves backward across a year boundary', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
})

describe('todayRange', () => {
  test('is today to today, for "Hoy"', () => {
    expect(todayRange('2026-10-03')).toEqual({ start: '2026-10-03', end: '2026-10-03' })
  })
})

describe('weekRange', () => {
  test('a Sunday closes the week begun on the Monday before it, across a month', () => {
    // 2026-10-04 is a Sunday; its week starts Monday 2026-09-28.
    expect(weekRange('2026-10-04')).toEqual({ start: '2026-09-28', end: '2026-10-04' })
  })

  test('a Monday opens the week it is in', () => {
    // 2026-10-05 is a Monday.
    expect(weekRange('2026-10-05')).toEqual({ start: '2026-10-05', end: '2026-10-11' })
  })

  test('a week can cross a year boundary', () => {
    // 2026-12-28 is a Monday; its Sunday is 2027-01-03.
    expect(weekRange('2026-12-28')).toEqual({ start: '2026-12-28', end: '2027-01-03' })
  })

  test('a midweek day falls between its Monday and Sunday', () => {
    // 2026-10-03 is a Saturday, in the week of 2026-09-28 to 2026-10-04.
    expect(weekRange('2026-10-03')).toEqual({ start: '2026-09-28', end: '2026-10-04' })
  })
})

describe('monthRange', () => {
  test('a 31-day month', () => {
    expect(monthRange('2026-10-02')).toEqual({ start: '2026-10-01', end: '2026-10-31' })
  })

  test('a 30-day month', () => {
    expect(monthRange('2026-04-15')).toEqual({ start: '2026-04-01', end: '2026-04-30' })
  })

  test('February in a leap year', () => {
    expect(monthRange('2024-02-29')).toEqual({ start: '2024-02-01', end: '2024-02-29' })
  })

  test('February in a non-leap year', () => {
    expect(monthRange('2025-02-14')).toEqual({ start: '2025-02-01', end: '2025-02-28' })
  })

  test('also serves as Fechas\' opening range: the current month\'s first and last day', () => {
    expect(monthRange('2026-01-20')).toEqual({ start: '2026-01-01', end: '2026-01-31' })
  })
})

describe('maxSaleDate', () => {
  test('a sale cannot be dated later than today', () => {
    expect(maxSaleDate('2026-10-03')).toBe('2026-10-03')
  })
})

describe('parseMonth', () => {
  const TODAY = '2026-10-02'

  test.each([
    ['absent', '', '2026-10'],
    ['empty', 'month=', '2026-10'],
    ['garbage', 'month=garbage', '2026-10'],
    ['month 13', 'month=2026-13', '2026-10'],
    ['month 00', 'month=2026-00', '2026-10'],
    ['one-digit month', 'month=2026-1', '2026-10'],
    ['a full date', 'month=2026-10-01', '2026-10'],
    ['a valid past month', 'month=2026-01', '2026-01'],
    ['a valid future month', 'month=2027-03', '2027-03'],
    ['two values: the first valid one', 'month=2026-03&month=2026-04', '2026-03'],
    ['two values: the first is garbage, the second valid', 'month=x&month=2026-04', '2026-04'],
    ['other parameters are ignored', 'q=1&month=2025-12', '2025-12'],
  ])('%s', (_name, search, expected) => {
    expect(parseMonth(new URLSearchParams(search), TODAY)).toBe(expected)
  })
})
