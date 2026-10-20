/**
 * The fixed lines of Análisis (empty states and help lines), registered for
 * `copy/copyLimits.test.ts`. `Analisis.tsx` renders these same bindings.
 */

import { SAMPLES, type LimitedCopy } from './limits'
import { EMPTY_STATES } from './emptyStates'

export const LANGUAGE: 'es' | 'en' = 'es'

export const NO_HISTORY_LINE = EMPTY_STATES.analysisNoHistory
export const EMPTY_MONTH_LINE = EMPTY_STATES.analysisEmptyMonth
export const VARIETY_TOTAL_NOTE = 'La tabla de variedades suma las ventas del mes sin el envío.'
export const SINCE_FIRST_RECORD_LABEL =
  'Movido desde tu primer registro, no es la plata que tenés en caja'
export const PURCHASES_NOTE = 'Van aparte, se cargan en Stock'
export const NO_BEST_WEEK_LINE = 'Ninguna se destacó'

export const COST_OF_GOODS_LABEL = 'Costo de lo vendido'
export const SHORTFALL_LABEL = 'Faltante de stock'
export const PROMOTION_LABEL = 'Promoción'
export const OWN_USE_LABEL = 'Consumo propio'
const PENDING_ONLY = `${SAMPLES.grams} sin costo`
const AMOUNT_AND_PENDING = `${SAMPLES.amount} y ${SAMPLES.grams} sin costo`

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

/** Every text a person reads in this area that is not a named message above, by key. */
export const ANALYSIS_TEXT = {
  text: '‹',
  comprasDeFlores: 'Compras de flores',
  vendisteEnElMes: 'Vendiste en el mes',
  vendidos: ' vendidos · ',
  regalados: ' regalados',
  margenPromedio01: (percent: string | number, pending_grams: string | number) => ` · margen promedio ${percent}%${pending_grams}`,
  margenPromedio0: (pending_grams: string | number) => ` · margen promedio${pending_grams}`,
  porVariedad: 'Por variedad',
  delMes: '% del mes',
  costo: 'costo ',
  margen: 'margen ',
  parte: 'Parte',
  gramosRegalo: 'Gramos regalo',
  costo2: 'Costo',
  margen2: 'Margen',
  text2: '%',
  semanaASemanaUltimas: 'Semana a semana · últimas 8',
  gastos: 'gastos ',
  ganancia: 'ganancia ',
  caja: 'caja ',
  semana: 'Semana',
  mesAMesUltimos: 'Mes a mes · últimos 12',
  mes: 'Mes',
  porDiaDeLa: 'Por día de la semana',
  ventas: ' ventas',
  gastosDelMes: 'Gastos del mes',
  gastosDesdeElPrimer: 'Gastos desde el primer registro',
  analisis: 'Análisis',
  mejorSemana: 'Mejor semana',
  mejorDia: 'Mejor día',
  lun: 'Lun',
  mar: 'Mar',
  mie: 'Mié',
  jue: 'Jue',
  vie: 'Vie',
  sab: 'Sáb',
  dom: 'Dom',
} as const
