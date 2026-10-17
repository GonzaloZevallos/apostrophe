/**
 * The text-ledgers (ADR-0048): `textLeft/<owner>.json` lists, one file per owner, the files
 * that still write a visible literal of their own. A ledger only shrinks: a file that
 * offends and is in no ledger fails, and so does an entry whose file no longer offends or
 * no longer exists. Each file is in exactly one ledger.
 *
 * `ledgerProblems` is the pure check; `appText.real.test.ts` applies it to the real tree.
 */

/** The violations, each a sentence naming a path and the rule (never the text's data). */
export function ledgerProblems(offenders: readonly string[], ledgers: Readonly<Record<string, readonly string[]>>): string[] {
  const problems: string[] = []
  const owners = new Map<string, string[]>()
  for (const [owner, files] of Object.entries(ledgers)) {
    for (const file of files) owners.set(file, [...(owners.get(file) ?? []), owner])
  }
  const offending = new Set(offenders)
  for (const file of [...offending].sort()) {
    if (!owners.has(file)) problems.push(`${file} writes a visible literal and is in no ledger: move it to src/copy/`)
  }
  for (const [file, among] of [...owners].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (among.length > 1) problems.push(`${file} is in ${among.length} ledgers (${among.join(', ')}): exactly one`)
    if (!offending.has(file)) problems.push(`${file} is in a ledger and no longer offends: drop the entry`)
  }
  return problems
}
