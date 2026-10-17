/**
 * The words inside the app's formats (ADR-0048): weekday and month names, "Today" and
 * "since", the sales count and the pending-cost wording of a figure. Only the words are
 * here; the numbers and symbols (`$ 11.000`, `3,5 g`, `dd/mm`) are written by `format/`.
 * Monday stays the first day of the week.
 */

import type { LimitedCopy } from './limits'

/** "Today 07/10": the chip of a date that is today. */
export const TODAY = 'Today'

/** "since 02/10": a price effective from a date. */
export const sinceDate = (date: string) => `since ${date}`

/** Index 0 is January. */
export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

/** Index 0 is Monday. */
export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

/** The unit after a grams figure: `3,5 g`. */
export const GRAMS_SUFFIX = ' g'

/** "1 sale" and "N sales": the one author of a sales count's wording. */
export const salesCount = (count: number) => (count === 1 ? '1 sale' : `${count} sales`)

/** "and 2,5 g not yet costed": after an amount, or after a figure that already shows one.
 * `grams` is the grams as the format shows them. */
export const andPending = (grams: string) => `and ${grams} not yet costed`

/** "4 g not yet costed": a figure whose every gram is pending, never shown as "$ 0". */
export const pendingOnly = (grams: string) => `${grams} not yet costed`

export const LIMITED_COPY: readonly LimitedCopy[] = []
export const LONG_REFUSALS: readonly string[] = []
