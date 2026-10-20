/**
 * The fixed lines of Análisis (empty states and help lines), registered for
 * `copy/copyLimits.test.ts`. `Analisis.tsx` renders these same bindings.
 */

import { andPending, pendingOnly } from './format.ts'
import { SAMPLES, type LimitedCopy } from './limits.ts'
import { TAB_EXPENSES } from './shell.ts'
import {
  OWN_USE,
  PAID_CASH,
  PROMOTION,
  WORD_GRAMS,
  WORD_MONTH,
  WORD_SHARE,
  WORD_VARIETY,
  WORD_WEEK,
} from './common.ts'

export const NO_HISTORY_LINE = 'Nothing to analyze yet.'
export const EMPTY_MONTH_LINE = 'You sold and gifted nothing this month.'
export const VARIETY_TOTAL_NOTE = "The varieties table adds up the month's sales without shipping."
export const SINCE_FIRST_RECORD_LABEL = 'Moved since your first record, not the cash you have on hand'
export const PURCHASES_NOTE = 'Listed apart, entered in Stock'
export const NO_BEST_WEEK_LINE = 'None stood out'

export const COST_OF_GOODS_LABEL = 'Cost of goods sold'
export const SHORTFALL_LABEL = 'Stock shortfall'
export const PROMOTION_LABEL = PROMOTION
export const OWN_USE_LABEL = OWN_USE

/** The marks on the best week and the best weekday, and the table's short one. */
export const BEST_WEEK_MARK = 'Best week'
export const BEST_WEEKDAY_MARK = 'Best day'
export const BEST_WEEK_TABLE_MARK = 'best'

/** The words Home's panel shares: the section that owns them is this one (Home imports). */
export const SOLD_THIS_MONTH = 'You sold this month'
export const PROFIT = 'Profit'
export const CASH = PAID_CASH
export const EXPENSES = TAB_EXPENSES
export const FLOWER_PURCHASES = 'Flower purchases'
export const WEEK = WORD_WEEK
export const MONTH = WORD_MONTH

export const MONTH_PREVIOUS = 'Previous month'
export const MONTH_NEXT = 'Next month'

export const BY_VARIETY = 'By variety'
export const WEEK_BY_WEEK = 'Week by week · last 8'
export const MONTH_BY_MONTH = 'Month by month · last 12'
export const BY_WEEKDAY = 'By weekday'
export const MONTH_EXPENSES_TITLE = "This month's expenses"
export const SINCE_FIRST_RECORD_EXPENSES_TITLE = 'Expenses since the first record'

/** The phone's inline labels, each after its figure or before it as the sentence reads. */
export const soldAndGifted = (sold: string, gifted: string) => `${sold} sold · ${gifted} gifted`
export const averageMargin = (percent: number | null, pending: string) =>
  percent === null ? ` · average margin${pending}` : ` · average margin ${percent}%${pending}`
export const shareOfMonth = (percent: number) => `${percent}% of the month`
export const gramsSold = (grams: string) => `${grams} sold`
export const gramsGifted = (grams: string) => `${grams} gifted`
export const costOf = (amount: string, pending: string) => `cost ${amount}${pending}`
export const marginOf = (amount: string, percent: number | null, pending: string) =>
  `margin ${amount}${percent === null ? '' : ` (${percent}%)`}${pending}`
export const expensesOf = (amount: string) => `expenses ${amount}`
export const profitOf = (amount: string, pending: string) => `profit ${amount}${pending}`
export const cashOf = (amount: string) => `cash ${amount}`

/** The column headers of the computer's tables. */
export const COL_VARIETY = WORD_VARIETY
export const COL_SHARE = WORD_SHARE
export const COL_GRAMS = WORD_GRAMS
export const COL_GIFT_GRAMS = 'Gifted grams'
export const COL_COST = 'Cost'
export const COL_MARGIN = 'Margin'

const PENDING_ONLY = pendingOnly(SAMPLES.grams)
const AMOUNT_AND_PENDING = `${SAMPLES.amount} ${andPending(SAMPLES.grams)}`

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyLine', text: NO_HISTORY_LINE },
  { kind: 'emptyLine', text: EMPTY_MONTH_LINE },
  { kind: 'help', text: VARIETY_TOTAL_NOTE },
  { kind: 'help', text: SINCE_FIRST_RECORD_LABEL },
  { kind: 'help', text: PURCHASES_NOTE },
  { kind: 'help', text: NO_BEST_WEEK_LINE },
  // The cost lines on the rows, the month header and "Desde el primer registro"
  // (`formatRowCost`): each label with its longest form, a fully pending one reading
  // only its grams.
  ...[COST_OF_GOODS_LABEL, SHORTFALL_LABEL, PROMOTION_LABEL, OWN_USE_LABEL].flatMap(
    (label): LimitedCopy[] => [
      { kind: 'help', text: `${label} ${PENDING_ONLY}` },
      { kind: 'help', text: `${label} ${AMOUNT_AND_PENDING}` },
    ],
  ),
]
export const LONG_REFUSALS: readonly string[] = []
