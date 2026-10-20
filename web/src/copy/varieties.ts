/** The fixed Spanish of the varieties list, Archivadas and the whole price history that is
 * always on screen: the empty states and the one help line. Each is a binding the screen
 * renders, listed in `LIMITED_COPY` with its kind (`copy/copyLimits.test.ts` measures it). */

import { type LimitedCopy } from './limits'
import type { RefusalCode } from '../api/refusals'
import type { SuccessToast } from '../components/AvisoExito'


export const EMPTY_TITLE = 'Todavía no cargaste ninguna variedad'
export const EMPTY_DETAIL = 'Agregá la primera con su precio para poder vender y mandar tu catálogo.'
export const NO_ARCHIVED_MESSAGE = 'No tenés variedades archivadas'
export const PRICE_HISTORY_HELP = 'Cada venta usa el precio que regía ese día, aunque lo cambies después.'
/** Why "Mandar catálogo" is disabled, only while the first-run checklist shows and nothing qualifies. */
export const CATALOG_DISABLED_REASON = 'Cargá una variedad con precio y su stock'

const LIMITED_COPY_0: readonly LimitedCopy[] = [
  { kind: 'emptyTitle', text: EMPTY_TITLE },
  { kind: 'emptyLine', text: EMPTY_DETAIL },
  { kind: 'emptyTitle', text: NO_ARCHIVED_MESSAGE },
  { kind: 'help', text: PRICE_HISTORY_HELP },
  { kind: 'help', text: CATALOG_DISABLED_REASON },
]
/** The fixed help lines under the price form's fields and the new-variety form's name,
 * always on screen, and the toast after a price is saved (`PRICE_SAVED`, which `AvisoExito`
 * types on). The screens render these same bindings; `LIMITED_COPY` lists them
 * for `copy/copyLimits.test.ts`. */


export const PRICE_PER_GRAM_HELP = 'Por gramo, en pesos enteros'
export const PRICE_DISCOUNT_HELP = 'Opcional · menor al precio de lista'
export const PRICE_FROM_GRAMS_HELP = 'Desde cuántos gramos aplica'
export const VARIETY_NAME_HELP = 'Hasta 60 caracteres · no puede repetir el nombre de otra variedad'

/** A toast, not always-visible copy, so it is not in `LIMITED_COPY`. */
export const PRICE_SAVED = 'Precio guardado'

const LIMITED_COPY_1: readonly LimitedCopy[] = [
  { kind: 'help', text: PRICE_PER_GRAM_HELP },
  { kind: 'help', text: PRICE_DISCOUNT_HELP },
  { kind: 'help', text: PRICE_FROM_GRAMS_HELP },
  { kind: 'help', text: VARIETY_NAME_HELP },
]
/** The fixed Spanish of the low-stock warning's form and switch, and the one table from a
 * refusal of `PUT /stock/varieties/{id}/threshold` to its message. */


export const THRESHOLD_INVALID_MESSAGE = 'Revisá el umbral cargado'
export const THRESHOLD_SAVED: SuccessToast = 'Aviso guardado'

export const THRESHOLD_OVERRIDES: Partial<Record<RefusalCode, string>> = {
  'stock.threshold_invalid': THRESHOLD_INVALID_MESSAGE,
}

/** No always-visible help line or notice lives here yet. Checked by `copy/copyLimits.test.ts`. */
const LIMITED_COPY_2: readonly LimitedCopy[] = []

export const LIMITED_COPY: readonly LimitedCopy[] = [...LIMITED_COPY_0, ...LIMITED_COPY_1, ...LIMITED_COPY_2]
export const LONG_REFUSALS: readonly string[] = []
