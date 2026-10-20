/**
 * The fixed words of the catalog screen that are always on screen, shared with its test
 * (no JSX). Listed in `LIMITED_COPY` so `copy/copyLimits.test.ts` measures the very
 * bindings `Catalogo` renders.
 */

import type { LimitedCopy } from './limits'
import { EMPTY_STATES } from './emptyStates'

export const LANGUAGE: 'es' | 'en' = 'es'

export const EMPTY_STATE_TITLE = EMPTY_STATES.catalogTitle
export const EMPTY_STATE_DETAIL = EMPTY_STATES.catalogDetail

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyTitle', text: EMPTY_STATE_TITLE },
  { kind: 'emptyLine', text: EMPTY_STATE_DETAIL },
]
export const LONG_REFUSALS: readonly string[] = []

/** Every text a person reads in this area that is not a named message above, by key. */
export const CATALOG_TEXT = {
  catalogo: 'Catálogo',
  comoSeVeEn: 'Cómo se ve en Telegram',
  queNoSaleY: 'Qué no sale y por qué',
  editarEncabezadoYPie: 'Editar encabezado y pie',
  catalogoCopiado: 'Catálogo copiado',
  noSePudoCopiar: 'No se pudo copiar.',
  noSePudoCompartir: 'No se pudo compartir.',
} as const
