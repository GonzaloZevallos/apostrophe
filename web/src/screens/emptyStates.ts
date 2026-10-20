/**
 * Every fixed empty or no-activity wording of the screens, kept in `web/src/copy/`, listed once. The screens
 * render from here (and re-export what their tests import), and the mobile standard
 * imports `EMPTY_STATE_WORDINGS` as the list a loading screen must never show: adding a
 * key here is enough for the check to forbid it while data loads. A literal copy in a
 * screen fails `emptyStates.test.ts`.
 */

import * as analysis from '../copy/analysis.ts'
import * as catalog from '../copy/catalog.ts'
import { NOBODY_OWES } from '../copy/common.ts'
import * as customers from '../copy/customers.ts'
import * as home from '../copy/home.ts'
import * as sales from '../copy/sales.ts'
import * as stock from '../copy/stock.ts'

export const EMPTY_STATES = {
  salesList: sales.EMPTY_LIST,
  customersList: customers.EMPTY_CUSTOMERS,
  homeNobodyOwes: NOBODY_OWES,
  homeVarietiesTitle: home.EMPTY_TITLE,
  homeVarietiesDetail: home.EMPTY_DETAIL,
  stockTitle: stock.EMPTY_STATE_TITLE,
  stockDetail: stock.EMPTY_STATE_DETAIL,
  catalogTitle: catalog.EMPTY_STATE_TITLE,
  catalogDetail: catalog.EMPTY_STATE_DETAIL,
  analysisNoHistory: analysis.NO_HISTORY_LINE,
  analysisEmptyMonth: analysis.EMPTY_MONTH_LINE,
} as const

export const EMPTY_STATE_WORDINGS: readonly string[] = Object.values(EMPTY_STATES)
