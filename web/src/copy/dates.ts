/** The dates words that are not a named message. */

import type { LimitedCopy } from './limits'

export const LANGUAGE: 'es' | 'en' = 'es'

export const LIMITED_COPY: readonly LimitedCopy[] = []
export const LONG_REFUSALS: readonly string[] = []

/** Every text a person reads in this area that is not a named message above, by key. */
export const DATES_TEXT = {
  oneSale: '1 venta',
  salesN: (n: number) => `${n} ventas`,
  owingSuffix: (sales: string) => `${sales} debiendo`,
  enero: 'Enero',
  febrero: 'Febrero',
  marzo: 'Marzo',
  abril: 'Abril',
  mayo: 'Mayo',
  junio: 'Junio',
  julio: 'Julio',
  agosto: 'Agosto',
  septiembre: 'Septiembre',
  octubre: 'Octubre',
  noviembre: 'Noviembre',
  diciembre: 'Diciembre',
} as const
