/**
 * The web wall-clock guard on its proof inputs (ADR-0043, amendment web-wall-clock): plain
 * `.txt` files, so the scan glob of `noWallClock.test.ts` can never reach them.
 */

import { describe, expect, it } from 'vitest'
import bareFakeTimers from './fixtures/bare_fake_timers.txt?raw'
import commented from './fixtures/commented.txt?raw'
import pinnedFakeTimers from './fixtures/pinned_fake_timers.txt?raw'
import wallClock from './fixtures/wall_clock.txt?raw'
import { findWallClockReads } from './wallClock.js'

describe('findWallClockReads', () => {
  it('flags each way of reading the real clock', () => {
    expect(findWallClockReads(wallClock)).toEqual([
      { line: 1, pattern: 'Date.now()' },
      { line: 2, pattern: 'new Date()' },
      { line: 3, pattern: 'Date()' },
    ])
  })

  it('exempts nothing for a bare useFakeTimers()', () => {
    expect(findWallClockReads(bareFakeTimers)).toEqual([{ line: 3, pattern: 'Date.now()' }])
  })

  it('exempts a file that pins a literal fake instant', () => {
    expect(findWallClockReads(pinnedFakeTimers)).toEqual([])
    expect(findWallClockReads("vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))\nDate.now()")).toEqual([])
  })

  it('does not take a computed instant for a literal', () => {
    expect(findWallClockReads('vi.setSystemTime(Date.now())')).toEqual([{ line: 1, pattern: 'Date.now()' }])
    expect(findWallClockReads('vi.useFakeTimers({ now: start })\nDate.now()')).toEqual([
      { line: 2, pattern: 'Date.now()' },
    ])
  })

  it('ignores comments, and its known limit stops at the line', () => {
    expect(findWallClockReads(commented)).toEqual([{ line: 5, pattern: 'Date.now()' }])
  })

  it('leaves dates built from arguments, Date.UTC and performance.now alone', () => {
    const text = "new Date('2026-01-01')\nnew Date(Date.UTC(2026, 0, 1))\nperformance.now()\nstamp.toDate()"
    expect(findWallClockReads(text)).toEqual([])
  })
})
