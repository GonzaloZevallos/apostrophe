/**
 * The plural-sensitivity check: the functions whose text depends on a count are exactly the
 * ones whose rows are wrapped in `counted()` (`src/copy/baselineArgs.ts`), so a plural
 * cannot be recorded with a fixture that hides it.
 */

import { isCounted } from '../../src/copy/baselineArgs.ts'
import { callCopy, walkModules, type CopyFunction, type Modules } from './baseline.ts'

/** Runs of digits are the count itself ("1 sale", "2 sales"); the words around it are what differ. */
const maskDigits = (text: string): string => text.replace(/\d+/g, '#')

/** The positions where some row holds a number: where the function admits a count. */
function numberPositions(rows: CopyFunction['rows']): number[] {
  const width = Math.max(...rows.map((row) => row.length))
  return Array.from({ length: width }, (_, position) => position).filter((position) =>
    rows.some((row) => typeof row[position] === 'number'),
  )
}

/** Whether the text of `fn` differs, digits aside, between a count of 1 and of 2 at any
 * position that takes a number; the other arguments come from the first row. */
function dependsOnCount({ source, fn, rows }: CopyFunction): boolean {
  const base = rows[0] ?? []
  return numberPositions(rows).some((position) => {
    const call = (count: number): string => callCopy(source, fn, base.map((arg, i) => (i === position ? count : arg)))
    return maskDigits(call(1)) !== maskDigits(call(2))
  })
}

/** One sentence per export that is wrapped in `counted` without needing it, or needs it
 * and is not. Empty when the two sets are the same. */
export function pluralProblems(modules: Modules): string[] {
  const problems: string[] = []
  for (const copyFunction of walkModules(modules).functions) {
    const wrapped = copyFunction.rows.some(isCounted)
    const sensitive = dependsOnCount(copyFunction)
    if (sensitive && !wrapped) problems.push(`${copyFunction.source}: its text depends on a count but its rows are not wrapped in counted()`)
    if (wrapped && !sensitive) problems.push(`${copyFunction.source}: wrapped in counted() but its text does not change between 1 and 2`)
  }
  return problems
}
