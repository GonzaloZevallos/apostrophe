/**
 * What a walked state is (a form, sheet or confirmation the phone walk visits beside the
 * registry's routes) and the one guard that keeps the walked states and `STATE_NAMES`
 * from drifting apart. Browserless: the Playwright spec imports it, vitest tests it.
 */

import type { RegistryStep } from './registry.ts'

/**
 * Clicks a control by its text or accessible name (`aria-label`) without a pointer: for
 * one with no visible text on the phone (an icon link) or one another element covers there
 * today (a list row or a button under the bar at 320 and 246). The cover itself is for the
 * geometry checkers to report, not for the walk to trip on.
 */
export interface ActivateStep {
  activate: string
}
export type WalkStep = RegistryStep | ActivateStep

export interface WalkState {
  /** Unique, and in `STATE_NAMES`: the name a `Violation.screen` carries. */
  screen: string
  /** Where the walk starts; `{name}` placeholders come from the seeded facts. */
  route: string
  steps: readonly WalkStep[]
  /** The text that must be on screen once the steps ran. */
  visible: string
}

/** What is wrong between the walked states and the names `Violation.screen` may carry. */
export function stateNameProblems(states: readonly WalkState[], names: readonly string[]): string[] {
  const walked = states.map((state) => state.screen)
  return [
    ...walked.filter((name) => !names.includes(name)).map((name) => `${name} is walked but not in STATE_NAMES`),
    ...names.filter((name) => !walked.includes(name)).map((name) => `${name} is in STATE_NAMES but never walked`),
    ...walked.filter((name, index) => walked.indexOf(name) !== index).map((name) => `${name} is walked twice`),
  ]
}
