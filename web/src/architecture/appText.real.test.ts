/** The visible-literal rule over the real tree (ADR-0048): no non-test `.ts`/`.tsx` writes a
 * text of its own. There is no allowance: a file that does is moved to `src/copy/`. */

import { expect, test } from 'vitest'
import { findVisibleLiterals, isScanned } from './appText'

const sources = import.meta.glob(['/src/**/*.ts', '/src/**/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

test('no scanned file writes a visible literal of its own, and there is no text-ledger left', () => {
  const scanned = Object.entries(sources)
    .map(([path, source]) => ({ path: path.replace(/^\//, ''), source }))
    .filter(({ path }) => isScanned(path))
  expect(scanned.length).toBeGreaterThan(100)
  const offenders = scanned
    .filter(({ path, source }) => findVisibleLiterals(path, source).length > 0)
    .map(({ path }) => path)
  expect(offenders).toEqual([])
})

test('the text-ledger directory is gone', () => {
  const ledgers = import.meta.glob('./textLeft/*.json', { eager: true })
  expect(Object.keys(ledgers)).toEqual([])
})
