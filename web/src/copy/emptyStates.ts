/**
 * Every fixed empty or no-activity wording of the screens, written once. The screens
 * render from here (and re-export what their tests import), and the mobile standard
 * imports `EMPTY_STATE_WORDINGS` as the list a loading screen must never show: adding a
 * key here is enough for the check to forbid it while data loads. A literal copy in a
 * screen fails `emptyStates.test.ts`.
 */

export const LANGUAGE: 'es' | 'en' = 'es'

import { EMPTY_STATE_TITLE as STOCK_EMPTY_TITLE, EMPTY_STATE_DETAIL as STOCK_EMPTY_DETAIL } from './stock.ts'
import { EMPTY_STATE_TITLE as CATALOG_EMPTY_TITLE, EMPTY_STATE_DETAIL as CATALOG_EMPTY_DETAIL } from './catalog.ts'

export const EMPTY_STATES = {
  salesList: 'Todavía no registraste ninguna venta en este período.',
  customersList: 'Todavía no agregaste ningún cliente.',
  homeNobodyOwes: 'Nadie te debe',
  homeVarietiesTitle: 'Arrancá por las variedades',
  homeVarietiesDetail:
    'Cargá tu primera variedad con su precio. Sin precio no se puede vender.',
  // The stock and catalog wordings below are English in `copy/stock.ts` and `copy/catalog.ts`;
  // these keys stay (still Spanish, unused by any screen) only until this file flips to 'en',
  // because the snapshot check needs every key of an 'es' file to resolve.
  stockTitle: 'Sin entradas de stock',
  stockDetail: 'Cargá tu stock inicial o una compra',
  catalogTitle: 'No hay nada en el catálogo hoy',
  catalogDetail: 'No hay nada para copiar todavía',
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
