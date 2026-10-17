/** `ledgerProblems` refuses what it must: an offender no ledger holds, an entry that no
 * longer offends, and a file in two ledgers. */

import { expect, test } from 'vitest'
import { ledgerProblems } from './textLedger'

test('accepts offenders that are each in exactly one ledger', () => {
  expect(ledgerProblems(['src/a.ts', 'src/b.ts'], { shared: ['src/a.ts'], other: ['src/b.ts'] })).toEqual([])
})

test('refuses an offending file that is in no ledger', () => {
  expect(ledgerProblems(['src/a.ts', 'src/c.ts'], { shared: ['src/a.ts'] })).toEqual([
    'src/c.ts writes a visible literal and is in no ledger: move it to src/copy/',
  ])
})

test('refuses a ledger entry whose file no longer offends (a ledger only shrinks)', () => {
  expect(ledgerProblems(['src/a.ts'], { shared: ['src/a.ts', 'src/gone.ts'] })).toEqual([
    'src/gone.ts is in a ledger and no longer offends: drop the entry',
  ])
})

test('refuses a file held by two ledgers', () => {
  expect(ledgerProblems(['src/a.ts'], { shared: ['src/a.ts'], other: ['src/a.ts'] })).toEqual([
    'src/a.ts is in 2 ledgers (shared, other): exactly one',
  ])
})
