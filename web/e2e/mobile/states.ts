/**
 * The forms, sheets, confirmations and shared states the phone walk visits beside the
 * registry's routes. Each area adds its own list here, one spread per line; a state is
 * walked exactly like a registry screen, with its one visible-element assertion as the
 * last step, so a state the app cannot reach is recorded as `unreachable`, never skipped.
 */

import type { WalkScreen, WalkStep } from './walk.js'
import { RECORDS_STATES } from './statesRecords.js'

export interface WalkState {
  /** Unique, and in `STATE_NAMES`: the name a `Violation.screen` carries. */
  screen: string
  /** Where the walk starts; `{name}` placeholders come from the seeded facts. */
  route: string
  steps: readonly WalkStep[]
  /** The text that must be on screen once the steps ran. */
  visible: string
}

export const STATES: readonly WalkState[] = [...RECORDS_STATES]

/** A state as the walk runs it: a signed-in screen whose last step waits for `visible`. */
export function asScreen(state: WalkState): WalkScreen {
  return {
    screen: state.screen,
    route: state.route,
    path: state.route,
    viewport: null,
    signedOut: false,
    theme: null,
    steps: [...state.steps, { wait: state.visible }],
  }
}

export const STATE_SCREENS: readonly WalkScreen[] = STATES.map(asScreen)

/** What is wrong between the walked states and the names `Violation.screen` may carry. */
export function stateNameProblems(states: readonly WalkState[], names: readonly string[]): string[] {
  const walked = states.map((state) => state.screen)
  return [
    ...walked.filter((name) => !names.includes(name)).map((name) => `${name} is walked but not in STATE_NAMES`),
    ...names.filter((name) => !walked.includes(name)).map((name) => `${name} is in STATE_NAMES but never walked`),
    ...walked.filter((name, index) => walked.indexOf(name) !== index).map((name) => `${name} is walked twice`),
  ]
}
