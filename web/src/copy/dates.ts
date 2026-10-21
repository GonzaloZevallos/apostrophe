/** The dates words that are not a named message. */

import type { LimitedCopy } from './limits'

export const LANGUAGE: 'es' | 'en' = 'es'

export const LIMITED_COPY: readonly LimitedCopy[] = []
export const LONG_REFUSALS: readonly string[] = []

/** Every text a person reads in this area that is not a named message above, by key. */
export const DATES_TEXT = {
  oneSale: '1 sale',
  salesN: (n: number) => `${n} sales`,
  owingSuffix: (sales: string) => `${sales} owing`,
  enero: 'January',
  febrero: 'February',
  marzo: 'March',
  abril: 'April',
  mayo: 'May',
  junio: 'June',
  julio: 'July',
  agosto: 'August',
  septiembre: 'September',
  octubre: 'October',
  noviembre: 'November',
  diciembre: 'December',
} as const
