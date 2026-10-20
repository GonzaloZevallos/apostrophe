/**
 * The verdict on a screen whose API is held: what the page reports about its content
 * area while it waits. Four rules, each on what the seller would see and nothing else:
 * `blank-while-loading` (no content area, or one with nothing drawn in it), `aria-busy`
 * (the content area never says it is busy), `false-empty` (a fixed empty-state wording
 * shows before the answer) and `data-while-loading` (a digit or a currency symbol, which
 * a person would read as data). It returns Violations and decides nothing about them.
 */

import { nameTargets, type CellId, type Finding, type RawTarget } from './targets.ts'
import type { Violation } from './violation.ts'

export interface LoadingFacts {
  /** The content area (`main`) is missing, or nothing in it has text or a drawn surface. */
  blank: boolean
  /** The content area, or something in it, carries `aria-busy="true"`. */
  busy: boolean
  /** The elements showing a forbidden wording. */
  falseEmpty: readonly RawTarget[]
  /** The elements of the content area showing a digit or a currency symbol. */
  data: readonly RawTarget[]
}

export function judgeLoading(facts: LoadingFacts, cell: CellId): Violation[] {
  const findings: Finding[] = []
  if (facts.blank) findings.push({ rule: 'blank-while-loading', raw: null })
  if (!facts.busy) findings.push({ rule: 'aria-busy', raw: null })
  for (const raw of facts.falseEmpty) findings.push({ rule: 'false-empty', raw })
  for (const raw of facts.data) findings.push({ rule: 'data-while-loading', raw })
  return nameTargets(findings, cell)
}
