/**
 * The verdict on a screen whose API is held: what the page reports about its content
 * area while it waits. Four rules, each on what the seller would see and nothing else:
 * `blank-while-loading` (no content area, or one with nothing drawn in it), `aria-busy`
 * (the content area never says it is busy), `false-empty` (a fixed empty-state wording
 * shows before the answer) and `data-while-loading` (a digit or a currency symbol, which
 * a person would read as data). It returns Violations and decides nothing about them.
 */

import { judgeLanguage } from './language.ts'
import { nameTargets, type CellId, type Finding, type RawTarget } from './targets.ts'
import type { Violation } from './violation.ts'

/** One visible piece of text of the page and the element showing it. */
export interface ShownText {
  text: string
  raw: RawTarget
}

export interface LoadingFacts {
  /** `<html lang>` as the page reports it. */
  lang: string
  /** The content area (`main`) is missing, or nothing in it has text or a drawn surface. */
  blank: boolean
  /** The content area, or something in it, carries `aria-busy="true"`. */
  busy: boolean
  /** Every visible text of the page, which `judgeLoading` reads for a forbidden wording. */
  texts: readonly ShownText[]
  /** The elements of the content area showing a digit or a currency symbol. */
  data: readonly RawTarget[]
}

/**
 * What the loading judgement answers: `language` is the reason the step fails with when the
 * page is not in the run's locale (then `violations` is empty: a page in the wrong language
 * is not read for wordings), else `null`.
 */
export interface LoadingVerdict {
  language: string | null
  violations: Violation[]
}

export function judgeLoading(
  facts: LoadingFacts,
  cell: CellId,
  forbidden: readonly string[],
  runLocale: string,
): LoadingVerdict {
  const language = judgeLanguage(facts.lang, runLocale)
  if (language !== null) return { language, violations: [] }
  const findings: Finding[] = []
  if (facts.blank) findings.push({ rule: 'blank-while-loading', raw: null })
  if (!facts.busy) findings.push({ rule: 'aria-busy', raw: null })
  for (const shown of facts.texts) {
    if (forbidden.some((wording) => shown.text.includes(wording))) findings.push({ rule: 'false-empty', raw: shown.raw })
  }
  for (const raw of facts.data) findings.push({ rule: 'data-while-loading', raw })
  return { language: null, violations: nameTargets(findings, cell) }
}
