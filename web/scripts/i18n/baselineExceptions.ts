/**
 * The validator of `src/copy/baseline_exceptions.json`: the reasoned exceptions to the rule
 * that a moved plural key renders its baseline text in English. The file holds
 * `{ source, key, issue, reason }` entries and stays `[]` until one is justified.
 *
 * An entry is valid only when it excuses something real:
 * - it has exactly those four fields, with a `reason` and an `issue` of `EXCEPTION_ISSUES`;
 * - its `source` is a committed baseline row, mapped once, to `key`, and wrapped in `counted()`
 *   (read from `BASELINE_ARGS`, because the walker skips the exports a module moved to keys);
 * - `key` has `_one` and `_other` forms in `en`;
 * - at least one row renders differently from its baseline, or the entry is stale.
 *
 * `exceptedRows` hands those rows to `mappingProblems`, so each row is judged by exactly one
 * of the two validators. Messages name the entry, the rule and the source, never a text.
 */

import { isCounted } from '../../src/copy/baselineArgs.ts'
import { resolveKey, type Bundle } from '../../src/i18n/resolve.ts'
import type { Entry, Modules } from './baseline.ts'
import { mappedRows, type MappedRow, type MappingFile } from './baselineKeys.ts'

export const EXCEPTION_ISSUES = [350, 351, 352, 353] as const

const FIELDS = ['issue', 'key', 'reason', 'source']

interface Exception {
  source: string
  key: string
  issue: number
  reason: string
}

interface Checked {
  problems: string[]
  /** The entries with no problem, and the rows of each that render another text. */
  valid: { source: string; rows: MappedRow[] }[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const child = (node: unknown, name: string): unknown =>
  isRecord(node) && Object.hasOwn(node, name) ? node[name] : undefined

/** Whether `en` holds a text at `<key>_<suffix>`. */
function hasText(en: Bundle, key: string, suffix: string): boolean {
  const colon = key.indexOf(':')
  if (colon <= 0) return false
  const path = key.slice(colon + 1).split('.')
  const last = `${path.pop() ?? ''}_${suffix}`
  const parent = path.reduce<unknown>(child, en[key.slice(0, colon)])
  return typeof child(parent, last) === 'string'
}

/** Whether the source's `BASELINE_ARGS` rows hold a row built by `counted()`. */
function isCountedSource(modules: Modules, source: string): boolean {
  const colon = source.indexOf(':')
  const table = child(modules[source.slice(0, colon)], 'BASELINE_ARGS')
  const rows = child(table, source.slice(colon + 1))
  return Array.isArray(rows) && rows.some((row) => Array.isArray(row) && isCounted(row))
}

function differs(en: Bundle, row: MappedRow): boolean {
  try {
    return resolveKey(en, row.key, row.args) !== row.text
  } catch {
    return false
  }
}

/** The entry as an `Exception`, or the rule its shape breaks. */
function parseEntry(item: unknown): Exception | string {
  if (!isRecord(item)) return 'is not an object'
  if (Object.keys(item).sort().join() !== FIELDS.join()) return 'fields are not exactly source, key, issue and reason'
  const { source, key, issue, reason } = item
  if (typeof source !== 'string') return 'source is not a string'
  if (typeof key !== 'string') return 'key is not a string'
  if (typeof issue !== 'number') return 'issue is not a number'
  if (typeof reason !== 'string') return 'reason is not a string'
  return { source, key, issue, reason }
}

const isIssue = (issue: number): boolean => (EXCEPTION_ISSUES as readonly number[]).includes(issue)

function check(raw: unknown, committed: readonly Entry[], files: readonly MappingFile[], modules: Modules, en: Bundle): Checked {
  if (!Array.isArray(raw)) return { problems: ['the exceptions are not an array'], valid: [] }
  const rows = mappedRows(files, committed).rows
  const problems: string[] = []
  const valid: Checked['valid'] = []
  const seen = new Map<string, number>()
  raw.forEach((item: unknown, index) => {
    const parsed = parseEntry(item)
    if (typeof parsed === 'string') {
      problems.push(`entry ${index}: ${parsed}`)
      return
    }
    const { source, key, issue, reason } = parsed
    const own: string[] = []
    const plain = (rule: string): number => own.push(`entry ${index}: ${rule}`)
    const named = (rule: string): number => own.push(`entry ${index} (${source}): ${rule}`)
    if (reason.trim() === '') plain('reason is empty')
    if (!isIssue(issue)) plain(`issue is not one of ${EXCEPTION_ISSUES.join(', ')}`)
    const first = seen.get(source)
    if (first !== undefined) named(`source repeats entry ${first}`)
    else if (!committed.some((row) => row.source === source)) plain('source is not in the committed baseline')
    else {
      const mapping = files.find((file) => Object.hasOwn(file.mappings, source))?.mappings[source]
      if (mapping === undefined) named('source is not mapped')
      else if (mapping.key !== key) named('key is not the key its mapping gives')
      else if (!isCountedSource(modules, source)) named('source is not wrapped in counted()')
      else if (!hasText(en, key, 'one') || !hasText(en, key, 'other')) named('key has no _one and _other forms in en')
      else if (!rows.some((row) => row.source === source && differs(en, row))) named('every row renders its baseline text, the entry is stale')
    }
    if (first === undefined) seen.set(source, index)
    problems.push(...own)
    if (own.length === 0) valid.push({ source, rows: rows.filter((row) => row.source === source && differs(en, row)) })
  })
  return { problems: problems.sort(), valid }
}

/** The problems of the exceptions file, sorted; `[]` when every entry is valid. */
export function exceptionProblems(raw: unknown, committed: readonly Entry[], files: readonly MappingFile[], modules: Modules, en: Bundle): string[] {
  return check(raw, committed, files, modules, en).problems
}

/** The identities `<source>\u0000<row index>` of the rows a valid entry excuses: those that
 * render another text in `en`. An invalid entry excuses nothing. */
export function exceptedRows(raw: unknown, committed: readonly Entry[], files: readonly MappingFile[], modules: Modules, en: Bundle): ReadonlySet<string> {
  const excepted = new Set<string>()
  for (const { source, rows } of check(raw, committed, files, modules, en).valid) {
    for (const row of rows) excepted.add(`${source}\u0000${row.index}`)
  }
  return excepted
}
