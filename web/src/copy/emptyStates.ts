/**
 * Every fixed empty or no-activity wording of the screens, written once. The screens
 * render from here (and re-export what their tests import), and the mobile standard
 * imports `EMPTY_STATE_WORDINGS` as the list a loading screen must never show: adding a
 * key here is enough for the check to forbid it while data loads. A literal copy in a
 * screen fails `emptyStates.test.ts`.
 */

export const LANGUAGE: 'es' | 'en' = 'es'

export const EMPTY_STATES = {
  salesList: 'Todavía no registraste ninguna venta en este período.',
  customersList: 'Todavía no agregaste ningún cliente.',
  homeNobodyOwes: 'Nobody owes you',
  homeVarietiesTitle: 'Start with your varieties',
  homeVarietiesDetail:
    'Add your first variety with its price. Without a price it cannot be sold.',
  stockTitle: 'Sin entradas de stock',
  stockDetail: 'Cargá tu stock inicial o una compra',
  catalogTitle: 'No hay nada en el catálogo hoy',
  catalogDetail: 'No hay nada para copiar todavía',
  analysisNoHistory: 'There is nothing to analyze yet.',
  analysisEmptyMonth: 'You did not sell or give away anything this month.',
} as const

export const EMPTY_STATE_WORDINGS: readonly string[] = Object.values(EMPTY_STATES)
