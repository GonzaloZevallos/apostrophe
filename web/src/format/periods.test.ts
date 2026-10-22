/**
 * Period bounds (Hoy/Week/Mes) on the one shared `periods.vectors.json` (plan
 * invariant: "Period bounds are tested on both sides from the one shared
 * `web/src/format/periods.vectors.json`; no test hand-copies expected bounds") —
 * the same vectors the backend's `tests/results/test_periods.py` runs over
 * `app.results.domain.periods.periods`. `todayRange`/`weekRange`/`monthRange`
 * already exist in `dates.ts` (Ventas' own period tabs); this just pins them to
 * the shared vectors instead of Ventas' own hand-picked dates, so both sides are
 * tested against the same boundary cases (a week crossing a year, 29 February).
 */

import { expect, test } from 'vitest'
import { monthRange, todayRange, weekRange } from './dates'
import vectors from './periods.vectors.json'

for (const vector of vectors) {
  test(`${vector.today}: today/week/month bounds`, () => {
    expect(todayRange(vector.today)).toEqual(vector.today_range)
    expect(weekRange(vector.today)).toEqual(vector.week)
    expect(monthRange(vector.today)).toEqual(vector.month)
  })
}
