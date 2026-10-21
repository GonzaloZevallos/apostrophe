/**
 * Every fixed empty or no-activity wording of the screens, written once. The screens
 * render from here (and re-export what their tests import), and the mobile standard
 * imports `EMPTY_STATE_WORDINGS` as the list a loading screen must never show: adding a
 * key here is enough for the check to forbid it while data loads. A literal copy in a
 * screen fails `emptyStates.test.ts`.
 */

export const LANGUAGE: 'es' | 'en' = 'es'

import { EMPTY_STATE_TITLE as STOCK_EMPTY_TITLE, EMPTY_STATE_DETAIL as STOCK_EMPTY_DETAIL } from './stock'
import { EMPTY_STATE_TITLE as CATALOG_EMPTY_TITLE, EMPTY_STATE_DETAIL as CATALOG_EMPTY_DETAIL } from './catalog'

export const EMPTY_STATES = {
  salesList: 'Todavía no registraste ninguna venta en este período.',
  customersList: 'Todavía no agregaste ningún cliente.',
  homeNobodyOwes: 'Nadie te debe',
  homeVarietiesTitle: 'Arrancá por las variedades',
  homeVarietiesDetail:
    'Cargá tu primera variedad con su precio. Sin precio no se puede vender.',
  analysisNoHistory: 'Todavía no hay nada para analizar.',
  analysisEmptyMonth: 'No vendiste ni regalaste nada este mes.',
} as const

/** The stock and catalog wordings are written in their own copy files (translated with their
 * area); they are listed here so a loading screen is still forbidden from showing them. */
export const EMPTY_STATE_WORDINGS: readonly string[] = [
  ...Object.values(EMPTY_STATES),
  STOCK_EMPTY_TITLE,
  STOCK_EMPTY_DETAIL,
  CATALOG_EMPTY_TITLE,
  CATALOG_EMPTY_DETAIL,
]
