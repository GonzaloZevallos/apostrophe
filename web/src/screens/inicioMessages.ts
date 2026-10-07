/**
 * The fixed copy of Inicio's notices and empty state, registered for
 * `copy/copyLimits.test.ts`. `Inicio.tsx` renders these same bindings.
 */

import type { LimitedCopy } from '../copy/limits'

export const EMPTY_TITLE = 'Arrancá por las variedades'
export const EMPTY_DETAIL = 'Cargá tu primera variedad con su precio. Sin precio no se puede vender.'
export const PINNED_CATALOG_OUT_OF_DATE = 'Tu catálogo en Telegram está desactualizado'

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyTitle', text: EMPTY_TITLE },
  { kind: 'emptyLine', text: EMPTY_DETAIL },
  { kind: 'notice', text: PINNED_CATALOG_OUT_OF_DATE },
]
export const LONG_REFUSALS: readonly string[] = []
