/**
 * The web wall-clock guard on its proof inputs (ADR-0043, amendment web-wall-clock): plain
 * `.txt` files, so the scan glob of `noWallClock.test.ts` can never reach them. This file
 * holds no proof input of its own, and the real-tree scan covers it like any other.
 */

import { describe, expect, it } from 'vitest'
import allowedForms from './fixtures/allowed_forms.txt?raw'
import bareFakeTimers from './fixtures/bare_fake_timers.txt?raw'
import commented from './fixtures/commented.txt?raw'
import computedFakeTimers from './fixtures/computed_fake_timers.txt?raw'
import computedSetSystemTime from './fixtures/computed_set_system_time.txt?raw'
import pinnedFakeTimers from './fixtures/pinned_fake_timers.txt?raw'
import pinnedSetSystemTime from './fixtures/pinned_set_system_time.txt?raw'
import wallClock from './fixtures/wall_clock.txt?raw'
import { findWallClockReads } from './wallClock.js'

describe('findWallClockReads', () => {
  it('flags each way of reading the real clock', () => {
    expect(findWallClockReads(wallClock)).toEqual([
      { line: 1, pattern: 'Date.now' },
      { line: 2, pattern: 'new Date' },
      { line: 3, pattern: 'Date call' },
    ])
  })

  it('exempts nothing for a bare fake-timers call', () => {
    expect(findWallClockReads(bareFakeTimers)).toEqual([{ line: 3, pattern: 'Date.now' }])
  })

  it('exempts a file that pins a literal fake instant', () => {
    expect(findWallClockReads(pinnedFakeTimers)).toEqual([])
    expect(findWallClockReads(pinnedSetSystemTime)).toEqual([])
  })

  it('does not take a computed instant for a literal', () => {
    expect(findWallClockReads(computedSetSystemTime)).toEqual([{ line: 1, pattern: 'Date.now' }])
    expect(findWallClockReads(computedFakeTimers)).toEqual([{ line: 2, pattern: 'Date.now' }])
  })

  it('ignores comments, and its known limit stops at the line', () => {
    expect(findWallClockReads(commented)).toEqual([{ line: 5, pattern: 'Date.now' }])
  })

  it('leaves dates built from arguments, a UTC date and the monotonic timer alone', () => {
    expect(findWallClockReads(allowedForms)).toEqual([])
  })
})
