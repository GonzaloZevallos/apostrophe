/**
 * The one author of a sales count's wording: `sales:section.count` (with its plural forms),
 * read through `salesCount`. Home (`PeriodFigures`, `InicioPanel`) and Sales (`Ventas`) word
 * the same API figure the same way by calling these with their own `t`, never by their own
 * plural.
 */

import type { TFunction } from 'i18next'
import { DATES_TEXT } from '../copy/dates'

/** `1` → `"1 sale"`; every other count, `0` included, → `"N sales"`. */
export function salesCount(t: TFunction, n: number): string {
  return t('sales:section.count', { count: n })
}

/** The Owed block's count line (`payments.md`): `1` → `"1 sale owing"`, `N` → `"N sales owing"`. */
export function salesOwingCount(t: TFunction, n: number): string {
  return DATES_TEXT.owingSuffix(salesCount(t, n))
}

/** A segment's count, already split for display: the decorative `mark` and the `figure`. */
export interface SegmentCount {
  mark: string
  figure: string
}

const SEGMENT_FIGURE_FMT = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

/**
 * The count beside a segment label, `· 1.234`, split so a screen reader can read the figure alone
 * (the mark is decoration). It formats what it is given: the server sends non-negative integers
 * and nothing here divides, rounds or compares them.
 */
export function segmentCount(n: number): SegmentCount {
  return { mark: '·', figure: SEGMENT_FIGURE_FMT.format(n) }
}
