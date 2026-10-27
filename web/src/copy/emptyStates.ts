/**
 * Every fixed empty or no-activity wording of the screens. The screens resolve `EMPTY_STATE_KEYS`
 * at render; `EMPTY_STATES` (English literals, byte-equal to `locales/en/emptyStates.json`) stays
 * only until the mobile standard reads the wordings from a bundle, and goes with it. A literal copy
 * in a screen fails `screens/emptyStates.test.ts`.
 */

import type { CopyKind } from './limits.ts'

export const LANGUAGE: 'es' | 'en' = 'en'

export const EMPTY_STATES = {
  salesList: "You haven't recorded any sales in this period yet.",
  customersList: 'You have not added any customers yet.',
  homeNobodyOwes: 'Nobody owes you',
  homeVarietiesTitle: 'Start with your varieties',
  homeVarietiesDetail: 'Add your first variety with its price. Without a price it cannot be sold.',
  stockTitle: 'No stock entries',
  stockDetail: 'Enter your initial stock or a purchase',
  catalogTitle: 'Nothing in the catalog today',
  catalogDetail: 'Nothing to copy yet',
  analysisNoHistory: 'There is nothing to analyze yet.',
  analysisEmptyMonth: 'You did not sell or give away anything this month.',
} as const

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

/** Every wording a loading screen is forbidden from showing. */
export const EMPTY_STATE_WORDINGS: readonly string[] = Object.values(EMPTY_STATES)
