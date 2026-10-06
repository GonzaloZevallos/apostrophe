import { describe, expect, test } from 'vitest'
import { summaryLine } from './summaryLine'

describe('summaryLine', () => {
  test('is none with no varieties', () => {
    expect(summaryLine([])).toBeNull()
  })

  test('says everything is fine when every variety is ok', () => {
    expect(summaryLine(['ok', 'ok', 'ok'])).toBe('3 variedades · todo ok')
    expect(summaryLine(['ok'])).toBe('1 variedad · todo ok')
  })

  test('counts every status that is not ok, by word, in stock-status order', () => {
    expect(summaryLine(['low', 'ok', 'sold_out', 'no_entries'])).toBe(
      '1 sin entradas · 1 agotada · 1 baja',
    )
  })

  test('leaves out the statuses nobody has and ignores ok', () => {
    expect(summaryLine(['ok', 'low', 'low', 'ok'])).toBe('2 bajas')
    expect(summaryLine(['sold_out', 'sold_out', 'ok'])).toBe('2 agotadas')
  })

  test('is never blank for a non-empty list', () => {
    for (const statuses of [['no_entries'], ['ok'], ['low'], ['sold_out']] as const) {
      expect(summaryLine([...statuses])).not.toBe('')
    }
  })
})
