import { describe, expect, test } from 'vitest'
import { formatDate, formatDateLong, formatDateShort, formatMonthLong, shiftMonth, sinceWhen } from './dates'

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
