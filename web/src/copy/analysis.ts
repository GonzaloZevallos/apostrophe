/**
 * The fixed lines of Análisis (empty states and help lines), registered for
 * `copy/copyLimits.test.ts`. `Analisis.tsx` renders these same bindings.
 */

import { SAMPLES, type LimitedCopy } from './limits.ts'

export const LANGUAGE: 'es' | 'en' = 'en'

export const NO_HISTORY_LINE = 'There is nothing to analyze yet.'
export const EMPTY_MONTH_LINE = 'You did not sell or give away anything this month.'
export const VARIETY_TOTAL_NOTE = 'The variety table adds up the sales of the month without shipping.'
export const SINCE_FIRST_RECORD_LABEL =
  'Moved since your first record, not the money you have in cash'
export const PURCHASES_NOTE = 'Kept apart, added in Stock'
export const NO_BEST_WEEK_LINE = 'None stood out'

export const COST_OF_GOODS_LABEL = 'Cost of goods sold'
export const SHORTFALL_LABEL = 'Stock shortfall'
export const PROMOTION_LABEL = 'Promotion'
export const OWN_USE_LABEL = 'Own use'
const PENDING_ONLY = `${SAMPLES.grams} without cost`
const AMOUNT_AND_PENDING = `${SAMPLES.amount} and ${SAMPLES.grams} without cost`

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyLine', text: NO_HISTORY_LINE },
  { kind: 'emptyLine', text: EMPTY_MONTH_LINE },
  { kind: 'help', text: VARIETY_TOTAL_NOTE },
  { kind: 'help', text: SINCE_FIRST_RECORD_LABEL },
  { kind: 'help', text: PURCHASES_NOTE },
  { kind: 'help', text: NO_BEST_WEEK_LINE },
  // The cost lines on the rows, the month header and "Since the first record"
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

/** Every text a person reads in this area that is not a named message above, by key. */
export const ANALYSIS_TEXT = {
  vendisteEnElMes: 'You sold in the month',
  vendidos: ' sold · ',
  regalados: ' given away',
  margenPromedio01: (percent: string | number, pending_grams: string | number) => ` · average margin ${percent}%${pending_grams}`,
  margenPromedio0: (pending_grams: string | number) => ` · average margin${pending_grams}`,
  porVariedad: 'By variety',
  delMes: '% of the month',
  costo: 'cost ',
  margen: 'margin ',
  parte: 'Part',
  gramosRegalo: 'Gift grams',
  costLabel: 'Cost',
  margen2: 'Margin',
  semanaASemanaUltimas: 'Week by week · last 8',
  gastos: 'expenses ',
  ganancia: 'profit ',
  caja: 'cash ',
  mesAMesUltimos: 'Month by month · last 12',
  porDiaDeLa: 'By day of the week',
  ventas: ' sales',
  gastosDelMes: 'Expenses of the month',
  gastosDesdeElPrimer: 'Expenses since the first record',
  mejorSemana: 'Best week',
  mejorDia: 'Best day',
  lun: 'Mon',
  mar: 'Tue',
  mie: 'Wed',
  jue: 'Thu',
  vie: 'Fri',
  sab: 'Sat',
  dom: 'Sun',
  pendingSuffix: (grams: string | number) => ` and ${grams} without cost`,
  noCostAlone: (grams: string | number) => `${grams} without cost`,
  bestInTable: 'best',
} as const
