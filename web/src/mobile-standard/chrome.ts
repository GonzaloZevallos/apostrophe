/**
 * Which chrome a phone screen carries, by its kind (`navigation.md`), and the one judge of
 * the `chrome-at-load` and `chrome-mid-scroll` rules. React-free: the page collector
 * (`e2e/mobile/collectChrome.ts`) reports facts only, and `judgeChrome` alone turns them
 * into `Violation`s.
 *
 * - tab root: the bar and "+ New sale";
 * - card or detail: the bar, no "+ New sale";
 * - form: neither;
 * - signed out (getting-in screens, flagged on the screen or state): neither;
 * - the header wherever the screen has one: absent is fine, present must be in view.
 *
 * Covered chrome (inside `[inert]` or `[aria-hidden="true"]`, or beneath an open modal)
 * always passes, and while a modal is open nothing is expected.
 */

import type { RouteRegistryEntry } from './registry.ts'
import type { CellId } from './targets.ts'
import type { Rule, Violation } from './violation.ts'

export type ChromeExpectation = 'root' | 'card' | 'form' | 'signedOut'
export type ChromeElement = 'bar' | 'newSale' | 'header'
export type ChromePhase = 'load' | 'mid'

/** What the page says about one chrome element in one scroll phase. */
export interface ChromeFact {
  element: ChromeElement
  phase: ChromePhase
  present: boolean
  inView: boolean
  covered: boolean
}

export interface ChromeFacts {
  /** A visible modal (`dialog:modal`, or `role=dialog|alertdialog` with `aria-modal="true"`) is open. */
  modalOpen: boolean
  elements: readonly ChromeFact[]
}

type Want = 'expected' | 'forbidden' | 'optional'

const TABLE: Record<ChromeExpectation, Record<ChromeElement, Want>> = {
  root: { bar: 'expected', newSale: 'expected', header: 'optional' },
  card: { bar: 'expected', newSale: 'forbidden', header: 'optional' },
  form: { bar: 'forbidden', newSale: 'forbidden', header: 'optional' },
  signedOut: { bar: 'forbidden', newSale: 'forbidden', header: 'optional' },
}

const ELEMENTS: readonly ChromeElement[] = ['bar', 'newSale', 'header']
const PHASES: readonly ChromePhase[] = ['load', 'mid']

const RULE_OF: Record<ChromePhase, Extract<Rule, 'chrome-at-load' | 'chrome-mid-scroll'>> = {
  load: 'chrome-at-load',
  mid: 'chrome-mid-scroll',
}

/** The fixed target of each chrome element: one per element and phase, so none repeats. */
const TARGET_OF: Record<ChromeElement, string> = {
  bar: 'chrome:bar',
  newSale: 'chrome:new-sale',
  header: 'chrome:header',
}

const ABSENT = { present: false, inView: true, covered: false }

export function judgeChrome(expectation: ChromeExpectation, facts: ChromeFacts, cell: CellId): Violation[] {
  const found: Violation[] = []
  for (const element of ELEMENTS) {
    for (const phase of PHASES) {
      const fact = facts.elements.find((f) => f.element === element && f.phase === phase) ?? ABSENT
      if (fact.covered) continue
      const want = TABLE[expectation][element]
      const wrong =
        want === 'forbidden'
          ? fact.present
          : want === 'expected'
            ? fact.present
              ? !fact.inView
              : !facts.modalOpen
            : fact.present && !fact.inView
      if (wrong) found.push({ ...cell, rule: RULE_OF[phase], target: TARGET_OF[element] })
    }
  }
  return found
}

const segmentsOf = (path: string): string[] => path.split('/').filter((segment) => segment !== '')
const isParameter = (segment: string): boolean => /^(:\w+|\{\w+\})$/.test(segment)

/** The number of literal segments of the row that matches `pathname`, or `null` when it does not. */
function specificity(pathname: string, row: string): number | null {
  const real = segmentsOf(pathname)
  const pattern = segmentsOf(row)
  if (real.length !== pattern.length) return null
  let literals = 0
  for (const [at, segment] of pattern.entries()) {
    if (isParameter(segment)) continue
    if (segment !== real[at]) return null
    literals += 1
  }
  return literals
}

/**
 * The kind of the row a real path belongs to, or `null` when no row matches. A parameter
 * matches any one segment; the row with the most literal segments wins (`/sales/new` is the
 * form, not the `/sales/{id}` card) and a tie throws.
 */
export function kindAt(pathname: string, rows: readonly RouteRegistryEntry[]): RouteRegistryEntry['kind'] | null {
  let best: { row: RouteRegistryEntry; literals: number } | null = null
  for (const row of rows) {
    const literals = specificity(pathname, row.path)
    if (literals === null) continue
    if (best !== null && literals === best.literals) {
      throw new Error(`${pathname} matches ${best.row.path} and ${row.path} equally`)
    }
    if (best === null || literals > best.literals) best = { row, literals }
  }
  return best === null ? null : best.row.kind
}

/**
 * What the screen at `pathname` is judged as. The `signedOut` flag comes from the screen or
 * state, never from the URL, and wins over whatever row the path matches. `null` is a path no
 * row matches.
 */
export function expectationFor(
  signedOut: boolean,
  pathname: string,
  rows: readonly RouteRegistryEntry[],
): ChromeExpectation | null {
  return signedOut ? 'signedOut' : kindAt(pathname, rows)
}
