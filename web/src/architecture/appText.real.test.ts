/** The visible-literal rule over the real tree (ADR-0048): every non-test `.ts`/`.tsx`
 * that writes a text of its own is in exactly one text-ledger, and a ledger only shrinks. */

import { expect, test } from 'vitest'
import { findVisibleLiterals, isScanned } from './appText'
import { ledgerProblems } from './textLedger'

const sources = import.meta.glob(['/src/**/*.ts', '/src/**/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const ledgerModules = import.meta.glob<string[]>('./textLeft/*.json', { import: 'default', eager: true })

const OWNERS = [
  'getting-in-settings',
  'home-analysis-expenses-onboarding',
  'sales-customers',
  'shared',
  'varieties-stock-catalog',
]

function ledgers(): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(ledgerModules).map(([path, files]) => [path.replace(/^.*\/(.*)\.json$/, '$1'), files]),
  )
}

test('the ledgers are exactly the owners the plan names', () => {
  expect(Object.keys(ledgers()).sort()).toEqual(OWNERS)
})

test('every file that writes a visible literal is in one ledger, and every ledger entry still offends', () => {
  const scanned = Object.entries(sources)
    .map(([path, source]) => ({ path: path.replace(/^\//, ''), source }))
    .filter(({ path }) => isScanned(path))
  expect(scanned.length).toBeGreaterThan(100)
  const offenders = scanned
    .filter(({ path, source }) => findVisibleLiterals(path, source).length > 0)
    .map(({ path }) => path)
  expect(ledgerProblems(offenders, ledgers())).toEqual([])
})
