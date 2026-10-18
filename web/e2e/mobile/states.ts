/**
 * The states the phone walk visits beside the registry's routes, as the walk runs them: a
 * screen whose last step waits for the state's one visible element, so a state the app
 * cannot reach is recorded as `unreachable`, never skipped. The states themselves (and the
 * guard on their names) are browserless, in `src/mobile-standard/`.
 */

import type { WalkState } from '../../src/mobile-standard/states.ts'
import type { WalkScreen } from './walk.js'

export function asScreen(state: WalkState): WalkScreen {
  return {
    screen: state.screen,
    route: state.route,
    path: state.route,
    viewport: null,
    signedOut: state.signedOut ?? false,
    theme: null,
    steps: [...state.steps, { wait: state.visible }],
  }
}
