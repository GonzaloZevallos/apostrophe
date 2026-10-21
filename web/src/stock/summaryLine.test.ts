import { describe, expect, test } from 'vitest'
import { summaryLine } from './summaryLine'

describe('summaryLine', () => {
  test('is none with no varieties', () => {
    expect(summaryLine([])).toBeNull()
  })

  test('says everything is fine when every variety is ok', () => {
    expect(summaryLine(['ok', 'ok', 'ok'])).toBe('3 varieties · all ok')
    expect(summaryLine(['ok'])).toBe('1 variety · all ok')
  })

  test('counts every status that is not ok, by word, in stock-status order', () => {
    expect(summaryLine(['low', 'ok', 'sold_out', 'no_entries'])).toBe(
      '1 no entries · 1 sold out · 1 low',
    )
  })

  test('leaves out the statuses nobody has and ignores ok', () => {
    expect(summaryLine(['ok', 'low', 'low', 'ok'])).toBe('2 low')
    expect(summaryLine(['sold_out', 'sold_out', 'ok'])).toBe('2 sold out')
  })

  test('is never blank for a non-empty list', () => {
    for (const statuses of [['no_entries'], ['ok'], ['low'], ['sold_out']] as const) {
      expect(summaryLine([...statuses])).not.toBe('')
    }
  })
})
