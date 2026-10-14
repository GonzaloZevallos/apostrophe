/**
 * The fixed always-visible lines of the Onboarding, shared with their screens and tests (no
 * JSX). They sit in `LIMITED_COPY`, the same bindings the steps render, so
 * `copy/copyLimits.test.ts` measures what the seller reads.
 */

import type { LimitedCopy } from '../../copy/limits'

/** Step 4: where the catalog is published, shown after a successful Probarlo. */
export const PUBLISH_LINE = 'Cuando quieras, publicalo desde Variedades → Mandar catálogo'
/** Step 6: the help line saying the categories save on their own. */
export const CATEGORIES_SAVE_LINE = 'Agregar, renombrar o sacar una categoría se guarda al toque.'

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'help', text: PUBLISH_LINE },
  { kind: 'help', text: CATEGORIES_SAVE_LINE },
]
export const LONG_REFUSALS: readonly string[] = []
