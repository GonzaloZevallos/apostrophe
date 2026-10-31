/**
 * What the page does when the location changes, as one pure function (navigation.md,
 * "Scroll on a change of screen", criteria 21-23; ADR-0068). `ScrollSync` is the only caller.
 * The rules read the screens table (`kind`-free: only `pane`, `parent` and `modalOnComputer`
 * of `routes.ts`) and the history state, never a list of paths.
 *
 *   - same pathname (a sheet's depth, a state-only change)        -> `none`
 *   - back or forward (POP)                                       -> `restore`
 *   - Record payment opened over its screen (state `underneath`)  -> `none` on the phone
 *       (the full-screen sheet has no outside, ADR-0062), `keep` on a computer
 *   - a computer's two panes (a list and the detail it picks)     -> `none`
 *   - a form that is a modal on a computer (`modalOnComputer`),
 *       opened over its screen                                    -> `none`: the page stays under it
 *   - any other PUSH or REPLACE                                   -> `top`
 */

import { hasPaymentUnderneath, parentOf, screenAtPath, type Screen, type Viewport } from '../routes'

export type NavigationAction = 'PUSH' | 'REPLACE' | 'POP'

/** What the page does: go to the top, go to the entry's stored offset, hold this one, or nothing. */
export type ScrollDecision = 'top' | 'restore' | 'keep' | 'none'

export interface PlaceInHistory {
  pathname: string
  state: unknown
}

/** The list a screen belongs to when it is one of a computer's two panes. */
function paneGroup(entry: Screen | undefined): string | undefined {
  if (entry === undefined || entry.pane === undefined) return undefined
  if (entry.pane === 'list') return entry.id
  return parentOf(entry.id, 'computer')?.id
}

function samePanes(from: PlaceInHistory, to: PlaceInHistory): boolean {
  const group = paneGroup(screenAtPath(from.pathname))
  return group !== undefined && group === paneGroup(screenAtPath(to.pathname))
}

export function decideScroll(
  from: PlaceInHistory,
  to: PlaceInHistory,
  action: NavigationAction,
  viewport: Viewport,
): ScrollDecision {
  if (from.pathname === to.pathname) return 'none'
  if (viewport === 'computer' && samePanes(from, to)) return 'none'
  if (action === 'POP') return 'restore'
  if (hasPaymentUnderneath(to.state)) return viewport === 'phone' ? 'none' : 'keep'
  if (viewport === 'computer' && screenAtPath(to.pathname)?.modalOnComputer === true) return 'none'
  return 'top'
}
