/**
 * The one way a test builds a `Debtors`: `debtorsOf(over)` spreads the API fixture and then `over`,
 * so a new field of the type lands in the fixture once and every test has it. The fixture's
 * `standing` is a plain string in JSON; `narrowStanding` checks it against `Standing`, so adding or
 * removing a `Standing` value breaks `tsc` here instead of casting the fixture.
 */

import debtorsFixture from '../api/fixtures/debtors.json'
import type { Debtor, Debtors, Standing } from '../api/payments'

const STANDING_VALUES: Record<Standing, true> = { owes: true, credit: true, settled: true }

function narrowStanding(value: string): Standing {
  for (const standing of Object.keys(STANDING_VALUES) as Standing[]) {
    if (standing === value) return standing
  }
  throw new Error(`The debtors fixture holds an unknown standing: ${value}`)
}

function fixtureDebtors(): Debtors {
  const rows: Debtor[] = debtorsFixture.debtors.map((row) => ({
    ...row,
    standing: narrowStanding(row.standing),
  }))
  return { ...debtorsFixture, debtors: rows }
}

export function debtorsOf(over: Partial<Debtors> = {}): Debtors {
  return { ...fixtureDebtors(), ...over }
}

export const NO_DEBTORS = debtorsOf({
  total_owed: 0,
  sales_owing_count: 0,
  debtor_count: 0,
  buckets: { this_week: 0, days_8_30: 0, over_30: 0 },
  debtors: [],
})
