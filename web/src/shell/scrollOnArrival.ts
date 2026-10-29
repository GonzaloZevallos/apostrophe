/**
 * Where the document is scrolled when the location changes (navigation.md, "Scroll on a change
 * of screen", GH-480, ADR-0064): one pure decision, from the pathname change, the navigation
 * type, the viewport and the registry (`kind`, `pane`, `modalOnComputer`, `ONBOARDING_SCREENS`),
 * and from nothing else: never the history key, the query, the fragment or the location state.
 *   - `restore`: Back or Forward, the screen returns to the offset it had when it was left.
 *   - `keep`: the page stays where it is (the same path, a screen drawn over the page it came
 *     from, a row picked in the two panes).
 *   - `top`: any other move to a different path opens the new screen at the top.
 */

import { ONBOARDING_SCREENS, SCREENS, screenOf, type ScreenId, type Viewport } from '../routes'

export type ScrollDecision = 'top' | 'keep' | 'restore'

export type NavigationType = 'POP' | 'PUSH' | 'REPLACE'

/** One end of a move: the pathname and the screen of its route (`handle.screen`); a route
 * outside `Shell` or the Onboarding (the public pages, the catch-all) has none. */
export interface Arrival {
  pathname: string
  screen: ScreenId | undefined
}

type TwoPaneLayout = 'customers' | 'varieties'

type PaneScreen = Extract<(typeof SCREENS)[number], { pane: 'list' | 'detail' }>['id']

/**
 * The screens the computer draws inside a two-pane layout, with the layout they share (the
 * route tree's `ClientesLayout` and `VarietiesLayout`). Every screen that declares a `pane`
 * must be here (the type), plus the new-variety form, which the computer draws as a modal
 * inside the Varieties panes with the list still visible. Moving between two screens of one
 * layout leaves the list where it is.
 */
const TWO_PANE_LAYOUT: Record<PaneScreen | 'variety-new', TwoPaneLayout> = {
  customers: 'customers',
  customer: 'customers',
  varieties: 'varieties',
  variety: 'varieties',
  'varieties-archived': 'varieties',
  'variety-new': 'varieties',
}

function layoutOf(screen: ScreenId | undefined): TwoPaneLayout | undefined {
  return screen !== undefined && screen in TWO_PANE_LAYOUT ? TWO_PANE_LAYOUT[screen as keyof typeof TWO_PANE_LAYOUT] : undefined
}

/** True when the screen is drawn over the page it came from: a sheet on the phone, a modal on a computer. */
function drawnOverThePage(screen: ScreenId | undefined, viewport: Viewport): boolean {
  if (screen === undefined) return false
  const entry = screenOf(screen)
  if (viewport === 'computer') return entry.modalOnComputer === true
  return entry.kind === 'form' && !ONBOARDING_SCREENS.has(screen)
}

export function scrollOnArrival(
  prev: Arrival,
  next: Arrival,
  navigationType: NavigationType,
  viewport: Viewport,
): ScrollDecision {
  if (navigationType === 'POP') return 'restore'
  if (prev.pathname === next.pathname) return 'keep'
  if (drawnOverThePage(next.screen, viewport)) return 'keep'
  if (viewport === 'computer') {
    const layout = layoutOf(next.screen)
    if (layout !== undefined && layout === layoutOf(prev.screen)) return 'keep'
  }
  return 'top'
}
