/**
 * Every fixed empty or no-activity wording of the screens, written once. The screens
 * render from here (and re-export what their tests import), and the mobile standard
 * imports `EMPTY_STATE_WORDINGS` as the list a loading screen must never show: adding a
 * key here is enough for the check to forbid it while data loads. A literal copy in a
 * screen fails `emptyStates.test.ts`.
 */

import { EMPTY_DETAIL, EMPTY_TITLE } from './inicio.ts'
import { EMPTY_MONTH_LINE, NO_HISTORY_LINE } from './analysis.ts'

export const LANGUAGE: 'es' | 'en' = 'es'

export const EMPTY_STATES = {
  salesList: 'Todavía no registraste ninguna venta en este período.',
  customersList: 'Todavía no agregaste ningún cliente.',
  homeNobodyOwes: 'Nadie te debe',
  homeVarietiesTitle: 'Arrancá por las variedades',
  homeVarietiesDetail:
    'Cargá tu primera variedad con su precio. Sin precio no se puede vender.',
  stockTitle: 'Sin entradas de stock',
  stockDetail: 'Cargá tu stock inicial o una compra',
  catalogTitle: 'No hay nada en el catálogo hoy',
  catalogDetail: 'No hay nada para copiar todavía',
  analysisNoHistory: 'Todavía no hay nada para analizar.',
  analysisEmptyMonth: 'No vendiste ni regalaste nada este mes.',
} as const

/** Inicio's and Análisis' English wordings are written in their own copy files (GH-53); the
 * Spanish originals above stay until `emptyStates` itself is translated. */
export const EMPTY_STATE_WORDINGS: readonly string[] = [
  ...Object.values(EMPTY_STATES),
  EMPTY_TITLE,
  EMPTY_DETAIL,
  NO_HISTORY_LINE,
  EMPTY_MONTH_LINE,
]
