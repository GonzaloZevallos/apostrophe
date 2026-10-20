/**
 * The names of the elements a `Violation` points at, for the checkers that read raw facts
 * from the page and let this side build the `Violation`s (colour, loading, layout shift):
 * the element's `data-testid`, or else `role:accessible name` with digit runs turned into
 * `#` and cut to `TARGET_MAX_LENGTH`. A repeated target carries the identity of its
 * nearest identified ancestor as `@identity`, and one that is still repeated takes a
 * positional ordinal `[n]` in document order, so N identical offenders are N Violations
 * and fixing or adding one always changes the diff. Same rule as the geometry collector's
 * own, which names in the page.
 */

import { RULE_KINDS, TARGET_MAX_LENGTH, type Rule, type Size, type Theme, type Violation } from './violation.ts'

/** What the page says about an element: enough to name it, nothing else. */
export interface RawTarget {
  testid: string
  role: string
  label: string
  /** The nearest identified ancestor: its `data-testid`, or else the text of the row it sits in. */
  identity: string
}

export function shorten(text: string): string {
  return text.replace(/\d+/g, '#').slice(0, TARGET_MAX_LENGTH)
}

function baseOf(raw: RawTarget): string {
  return raw.testid === '' ? shorten(`${raw.role}:${raw.label}`) : shorten(raw.testid)
}

export interface Finding {
  rule: Rule
  /** The element, or `null` for a page rule. */
  raw: RawTarget | null
}

export interface CellId {
  screen: string
  size: Size
  theme: Theme
}

export function nameTargets(findings: readonly Finding[], cell: CellId): Violation[] {
  const based = findings.map((finding) => ({
    rule: finding.rule,
    raw: finding.raw,
    base: finding.raw === null ? '' : baseOf(finding.raw),
  }))
  const count = (rule: Rule, target: string): number =>
    based.filter((other) => other.rule === rule && other.base === target).length
  const withIdentity = based.map((entry) => {
    const identity = entry.raw === null ? '' : shorten(entry.raw.identity)
    const repeated = entry.raw !== null && count(entry.rule, entry.base) > 1
    return { rule: entry.rule, target: repeated && identity !== '' ? `${entry.base}@${identity}` : entry.base }
  })
  const seen = new Map<string, number>()
  return withIdentity.map((entry) => {
    const key = `${entry.rule}|${entry.target}`
    const same = withIdentity.filter((other) => `${other.rule}|${other.target}` === key).length
    const ordinal = (seen.get(key) ?? 0) + 1
    seen.set(key, ordinal)
    const target = RULE_KINDS[entry.rule] === 'page' ? '' : same > 1 ? `${entry.target}[${ordinal}]` : entry.target
    return { screen: cell.screen, size: cell.size, theme: cell.theme, rule: entry.rule, target }
  })
}
