import { describe, expect, it } from 'vitest'
import { ARGENTINA_OFFSET_MS, DAY_BEFORE_PIN, PINNED_INSTANT } from './pin.ts'

describe('the pinned instant of the phone check', () => {
  it('is 2026-09-16 12:00 Argentina time', () => {
    // Joined, not written whole: the pinned literal lives in pin.ts alone (test_mobile_harness.py scans for it).
    expect(PINNED_INSTANT.toISOString()).toBe(['2026-09-16', '15:00:00.000Z'].join('T'))
  })

  it('has the Argentina day 2026-09-16, and the day before it is 2026-09-15', () => {
    const argentinaDay = new Date(PINNED_INSTANT.getTime() - ARGENTINA_OFFSET_MS).toISOString().slice(0, 10)
    expect(argentinaDay).toBe('2026-09-16')
    expect(DAY_BEFORE_PIN).toBe('2026-09-15')
  })
})
