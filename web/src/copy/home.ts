/**
 * The fixed copy of Inicio's notices and empty state, registered for
 * `copy/copyLimits.test.ts`. `Inicio.tsx` renders these same bindings.
 */

import { INVITE_A_PARTNER, NOBODY_OWES, WORD_COLLECT, WORD_PERIOD } from './common'
import {
  CASH,
  COST_OF_GOODS_LABEL,
  EXPENSES,
  FLOWER_PURCHASES,
  MONTH,
  OWN_USE_LABEL,
  PROFIT,
  PROMOTION_LABEL,
  SHORTFALL_LABEL,
  SOLD_THIS_MONTH,
  WEEK,
} from './analysis'
import { TODAY } from './format'
import type { LimitedCopy } from './limits'

export const EMPTY_TITLE = 'Start with varieties'
export const EMPTY_DETAIL = "Add your first variety with its price. You can't sell without one."
export const PINNED_CATALOG_OUT_OF_DATE = 'Your Telegram catalog is out of date'

export const CHECKLIST_TITLE = 'To get started'
export const CHECKLIST_REQUIRED = 'Required'
export const CHECKLIST_OPTIONAL = 'Optional'
export const CHECKLIST_DONE = 'Done'
export const STEP_PRICED_VARIETY = 'Add a variety with its price'
export const STEP_STOCK_ENTRY = 'Add what you have today'
export const STEP_PUBLISHED = 'Connect the bot'
export const STEP_SECOND_USER = INVITE_A_PARTNER
export const IMPORT_NOTICE = 'Connect the bot so the pinned catalog updates itself'
export const IMPORT_NOTICE_DISMISS = 'Dismiss notice'
/** The line under "+ New sale" while the checklist shows and no variety has a price. */
export const NUEVA_VENTA_MISSING = 'Add a price to a variety to be able to sell'

/** The panel's title and the pieces of its body: the period switch, the headings and the
 * rows. The cost words are read-only from the Analysis section that owns them. */
export const PANEL_PERIOD = WORD_PERIOD
export const TAB_TODAY = TODAY
export const TAB_WEEK = WEEK
export const TAB_MONTH = MONTH
export const SOLD_TODAY = 'You sold today'
export const SOLD_THIS_WEEK = 'You sold this week'
export const averageSale = (amount: string) => `average ${amount}`
export const STOCK_LEFT = 'What you have left'
export const GIFTED = 'You gifted'
export const PENDING_NOTE = 'includes pending cost'
export const OWED_HEADING = 'Owed to you'
export const COLLECT = WORD_COLLECT
export const collectFrom = (name: string) => `Collect from ${name}`
export {
  CASH,
  COST_OF_GOODS_LABEL,
  EXPENSES,
  FLOWER_PURCHASES,
  PROFIT,
  SOLD_THIS_MONTH,
  SHORTFALL_LABEL,
  PROMOTION_LABEL,
  OWN_USE_LABEL,
}

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyTitle', text: EMPTY_TITLE },
  { kind: 'emptyLine', text: EMPTY_DETAIL },
  { kind: 'emptyTitle', text: NOBODY_OWES },
  { kind: 'notice', text: PINNED_CATALOG_OUT_OF_DATE },
  { kind: 'notice', text: IMPORT_NOTICE },
  { kind: 'help', text: NUEVA_VENTA_MISSING },
  { kind: 'help', text: STEP_PRICED_VARIETY },
  { kind: 'help', text: STEP_STOCK_ENTRY },
  { kind: 'help', text: STEP_PUBLISHED },
  { kind: 'help', text: STEP_SECOND_USER },
]
export const LONG_REFUSALS: readonly string[] = []
