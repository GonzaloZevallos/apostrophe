/**
 * Where the document is scrolled when the location changes (navigation.md, "Scroll on arrival
 * and return", GH-480): one pure decision, taken once per location key, from the pathname
 * change, the navigation type, the sheet depth of both entries (`state.sheet`, ADR-0027), the
 * viewport and the registry (`kind`, `pane`, `modalOnComputer`) with the two typed records
 * below, and from nothing else: never the history key, the query, the fragment or any other
 * location state.
 *   - `restore`: a return through history, the screen goes back to the offset it was left at.
 *   - `keep`: the page stays where it is (the same screen, a screen drawn over the page it
 *     came from, a row picked in the two panes, an in-page sheet opened or closed).
 *   - `top`: any other move opens the new screen at the top.
 */

import { SCREENS, screenOf, type ScreenId, type Viewport } from '../routes'

export type ScrollDecision = 'top' | 'keep' | 'restore'

export type NavigationType = 'POP' | 'PUSH' | 'REPLACE'

/** One end of a move: its pathname, the screen of its route (`handle.screen`; a route outside
 * `Shell` and the Onboarding, such as a public page or the catch-all, has none) and the depth
 * of in-page sheets stacked on it (`state.sheet`, 0 when absent). */
export interface Arrival {
  pathname: string
  screen: ScreenId | undefined
  sheetDepth: number
}

type FormScreenId = Extract<(typeof SCREENS)[number], { kind: 'form' }>['id']

/**
 * How the phone draws each form: `'over'` is a sheet over the page it was opened from (the
 * page behind stays where it is); `'flow'` is a page of its own that opens at the top. Every
 * form must be placed here: the type fails `tsc` on one that is not.
 */
export const FORM_DRAWING: Record<FormScreenId, 'over' | 'flow'> = {
  'sale-new': 'over',
  'customer-new': 'over',
  'customer-edit': 'over',
  'customer-payment': 'over',
  'variety-new': 'over',
  'variety-price-new': 'over',
  'stock-entry-new': 'over',
  'stock-entry': 'over',
  'withdrawal-new': 'over',
  'withdrawal-edit': 'over',
  'expense-new': 'over',
  'settings-business': 'flow',
  'settings-users': 'flow',
  'settings-prices': 'flow',
  'settings-integrations': 'flow',
  'settings-catalog-message': 'flow',
  'settings-expense-categories': 'flow',
  'settings-appearance': 'flow',
  'settings-account': 'flow',
  onboarding: 'flow',
  'onboarding-variety': 'flow',
  'onboarding-stock': 'flow',
  'onboarding-catalog-message': 'flow',
  'onboarding-bot': 'flow',
  'onboarding-partner': 'flow',
  'onboarding-categories': 'flow',
  'onboarding-done': 'flow',
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
export const TWO_PANE_LAYOUT: Record<PaneScreen | 'variety-new', TwoPaneLayout> = {
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

/** Whether the phone draws `screen` as a form over the page it was opened from (`FORM_DRAWING`). */
export function isOverForm(screen: ScreenId): boolean {
  return screen in FORM_DRAWING && FORM_DRAWING[screen as FormScreenId] === 'over'
}

export function scrollOnArrival(prev: Arrival, next: Arrival, action: NavigationType, viewport: Viewport): ScrollDecision {
  const samePath = prev.pathname === next.pathname
  if (action === 'POP') return samePath && prev.sheetDepth !== next.sheetDepth ? 'keep' : 'restore'
  if (samePath) return 'keep'
  if (next.screen === undefined) return 'top'
  if (viewport === 'phone') {
    if (isOverForm(next.screen)) return 'keep'
    return 'top'
  }
  if (screenOf(next.screen).modalOnComputer === true) return 'keep'
  const layout = layoutOf(next.screen)
  if (layout !== undefined && layout === layoutOf(prev.screen)) return 'keep'
  return 'top'
}
