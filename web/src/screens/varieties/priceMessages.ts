/** The fixed help lines under the price form's fields and the new-variety form's name,
 * always on screen, and the toast after a price is saved (`PRICE_SAVED`, which `AvisoExito`
 * types on). The screens render these same bindings; `LIMITED_COPY` lists them
 * for `copy/copyLimits.test.ts`. */

import type { LimitedCopy } from '../../copy/limits'

export const PRICE_PER_GRAM_HELP = 'Por gramo, en pesos enteros'
export const PRICE_DISCOUNT_HELP = 'Opcional · menor al precio de lista'
export const PRICE_FROM_GRAMS_HELP = 'Desde cuántos gramos aplica'
export const VARIETY_NAME_HELP = 'Hasta 60 caracteres · no puede repetir el nombre de otra variedad'

/** A toast, not always-visible copy, so it is not in `LIMITED_COPY`. */
export const PRICE_SAVED = 'Precio guardado'

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'help', text: PRICE_PER_GRAM_HELP },
  { kind: 'help', text: PRICE_DISCOUNT_HELP },
  { kind: 'help', text: PRICE_FROM_GRAMS_HELP },
  { kind: 'help', text: VARIETY_NAME_HELP },
]
export const LONG_REFUSALS: readonly string[] = []
