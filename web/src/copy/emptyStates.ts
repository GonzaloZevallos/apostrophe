/**
 * Every fixed empty or no-activity wording of the screens, as keys and limits, with no wording
 * here (the English is `locales/en/emptyStates.json`). The screens resolve `EMPTY_STATE_KEYS` at
 * render and the mobile standard resolves them from the run's bundle; a literal copy in a screen
 * fails `screens/emptyStates.test.ts`.
 */

import type { CopyKind } from './limits.ts'

/**
 * The eleven wordings as keys of the `emptyStates` namespace (`locales/<tag>/emptyStates.json`).
 * Customers and Home share `nobodyOwes`. No words here: a screen resolves the key at render.
 */
export const EMPTY_STATE_KEYS = {
  salesList: 'emptyStates:salesList',
  customersList: 'emptyStates:customersList',
  nobodyOwes: 'emptyStates:nobodyOwes',
  homeVarietiesTitle: 'emptyStates:homeVarietiesTitle',
  homeVarietiesDetail: 'emptyStates:homeVarietiesDetail',
  stockTitle: 'emptyStates:stockTitle',
  stockDetail: 'emptyStates:stockDetail',
  catalogTitle: 'emptyStates:catalogTitle',
  catalogDetail: 'emptyStates:catalogDetail',
  analysisNoHistory: 'emptyStates:analysisNoHistory',
  analysisEmptyMonth: 'emptyStates:analysisEmptyMonth',
} as const

/** The limit kind of each empty state, measured in `en` by `copyLimits.real.test.ts`. */
export const EMPTY_STATE_LIMITS = {
  salesList: 'emptyLine',
  customersList: 'emptyTitle',
  nobodyOwes: 'emptyTitle',
  homeVarietiesTitle: 'emptyTitle',
  homeVarietiesDetail: 'emptyLine',
  stockTitle: 'emptyTitle',
  stockDetail: 'emptyLine',
  catalogTitle: 'emptyTitle',
  catalogDetail: 'emptyLine',
  analysisNoHistory: 'emptyLine',
  analysisEmptyMonth: 'emptyLine',
} as const satisfies Record<keyof typeof EMPTY_STATE_KEYS, CopyKind>
