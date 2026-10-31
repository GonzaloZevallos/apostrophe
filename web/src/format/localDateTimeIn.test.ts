/**
 * `localDateTimeIn`: the Time zone screen's preview, a plain unit test (CODING_STANDARDS §10).
 * The instants are literal epoch milliseconds and the offsets are what the API answers for each
 * zone at that instant, so a zone whose clocks go back is covered by passing its two offsets.
 */

import { expect, test } from 'vitest'
import { localDateTimeIn } from './dates'

const OCT_31_2330_UTC = 1793489400000
const NOV_1_0659_UTC = 1793516340000
const NOV_1_0700_UTC = 1793516400000
const OCT_25_0059_UTC = 1792889940000
const OCT_25_0100_UTC = 1792890000000

test('the same instant is another local day in Tokyo than in Buenos Aires', () => {
  expect(localDateTimeIn(OCT_31_2330_UTC, -180)).toBe('31/10 20:30')
  expect(localDateTimeIn(OCT_31_2330_UTC, 540)).toBe('01/11 08:30')
})

test('Los Angeles crosses midnight one minute apart, with 00 as the hour and never 24', () => {
  expect(localDateTimeIn(NOV_1_0659_UTC, -420)).toBe('31/10 23:59')
  expect(localDateTimeIn(NOV_1_0700_UTC, -420)).toBe('01/11 00:00')
})

test('Madrid on either side of its clocks going back', () => {
  expect(localDateTimeIn(OCT_25_0059_UTC, 120)).toBe('25/10 02:59')
  expect(localDateTimeIn(OCT_25_0100_UTC, 60)).toBe('25/10 02:00')
})

test('a half-hour zone and a year boundary', () => {
  expect(localDateTimeIn(OCT_31_2330_UTC, 330)).toBe('01/11 05:00')
  expect(localDateTimeIn(1798761540000, 60)).toBe('01/01 00:59')
})

test('a zone with no offset answered is unavailable, not an error', () => {
  expect(localDateTimeIn(OCT_31_2330_UTC, null)).toBeNull()
})
