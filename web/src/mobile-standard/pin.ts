/**
 * The instant the phone check pins both clocks to, and the day before it. Browserless: the
 * Playwright cells, the states and vitest import it, and `tests/design/test_mobile_harness.py`
 * reads this file as text to keep the literal equal to the server's `PINNED_INSTANT`.
 */

/** 2026-09-16 12:00 Argentina time, the instant the server's clock is pinned to. */
export const PINNED_INSTANT = new Date('2026-09-16T15:00:00Z')

/** Argentina is UTC-03:00 all year: it has no daylight saving. */
export const ARGENTINA_OFFSET_MS = 3 * 60 * 60 * 1000

const DAY_MS = 24 * 60 * 60 * 1000

/** The YYYY-MM-DD of the Argentina day before the pin, by UTC arithmetic so the machine's timezone cannot move it. */
export const DAY_BEFORE_PIN = new Date(PINNED_INSTANT.getTime() - ARGENTINA_OFFSET_MS - DAY_MS)
  .toISOString()
  .slice(0, 10)
