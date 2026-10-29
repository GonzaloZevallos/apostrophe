/**
 * The fixed words of the catalog screen that are always on screen, shared with its test
 * (no JSX). Listed in `LIMITED_COPY` so `copy/copyLimits.test.ts` measures the very
 * bindings `Catalogo` renders.
 */

import type { LimitedCopy } from './limits.ts'

export const LANGUAGE: 'es' | 'en' = 'en'

export const LIMITED_COPY: readonly LimitedCopy[] = [
]
export const LONG_REFUSALS: readonly string[] = []

/** Every text a person reads in this area that is not a named message above, by key. */
export const CATALOG_TEXT = {
  reasonHidden: 'hidden',
  reasonNoPrice: 'no price',
  comoSeVeEn: 'How it looks in Telegram',
  queNoSaleY: 'What does not go out and why',
  editarEncabezadoYPie: 'Edit header and footer',
  catalogoCopiado: 'Catalog copied',
  noSePudoCopiar: 'Could not copy.',
  noSePudoCompartir: 'Could not share.',
} as const
