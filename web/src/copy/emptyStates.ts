/**
 * Every fixed empty or no-activity wording of the screens, listed once. The screens
 * render from here (and re-export what their tests import), and the mobile standard
 * imports `EMPTY_STATE_WORDINGS` as the list a loading screen must never show: adding a
 * key here is enough for the check to forbid it while data loads. A literal copy in a
 * screen fails `emptyStates.test.ts`. Most wordings are written in their own area's copy
 * file and only referenced here, so each value has one owner.
 */

import { EMPTY_MONTH_LINE, NO_HISTORY_LINE } from './analysis.ts'
import type { CopyKind } from './limits.ts'
import { EMPTY_STATE_DETAIL as CATALOG_EMPTY_DETAIL, EMPTY_STATE_TITLE as CATALOG_EMPTY_TITLE } from './catalog.ts'
import { EMPTY_CUSTOMERS, NOBODY_OWES } from './customers.ts'
import { EMPTY_DETAIL, EMPTY_TITLE } from './inicio.ts'
import { EMPTY_STATE_DETAIL as STOCK_EMPTY_DETAIL, EMPTY_STATE_TITLE as STOCK_EMPTY_TITLE } from './stock.ts'

export const LANGUAGE: 'es' | 'en' = 'en'

export const EMPTY_STATES = {
  salesList: "You haven't recorded any sales in this period yet.",
  customersList: EMPTY_CUSTOMERS,
  homeNobodyOwes: NOBODY_OWES,
  homeVarietiesTitle: EMPTY_TITLE,
  homeVarietiesDetail: EMPTY_DETAIL,
  stockTitle: STOCK_EMPTY_TITLE,
  stockDetail: STOCK_EMPTY_DETAIL,
  catalogTitle: CATALOG_EMPTY_TITLE,
  catalogDetail: CATALOG_EMPTY_DETAIL,
  analysisNoHistory: NO_HISTORY_LINE,
  analysisEmptyMonth: EMPTY_MONTH_LINE,
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
