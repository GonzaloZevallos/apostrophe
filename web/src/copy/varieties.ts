/** The fixed Spanish of the varieties list, Archivadas, the whole price history, the price
 * form, the new-variety form's name and the low-stock warning's form: the empty states and
 * the help lines always on screen, the toasts after a price or a threshold is saved
 * (`PRICE_SAVED` and `THRESHOLD_SAVED`, which `AvisoExito` types on) and the one table from
 * a refusal of `PUT /stock/varieties/{id}/threshold` to its message. Each always-visible
 * line is a binding the screen renders, listed in `LIMITED_COPY` with its kind
 * (`copy/copyLimits.test.ts` measures it). */

import type { RefusalCode } from '../api/refusals'
import type { SuccessToast } from '../components/AvisoExito'
import type { LimitedCopy } from './limits'

export const EMPTY_TITLE = 'Todavía no cargaste ninguna variedad'
export const EMPTY_DETAIL = 'Agregá la primera con su precio para poder vender y mandar tu catálogo.'
export const NO_ARCHIVED_MESSAGE = 'No tenés variedades archivadas'
export const PRICE_HISTORY_HELP = 'Cada venta usa el precio que regía ese día, aunque lo cambies después.'
/** Why "Mandar catálogo" is disabled, only while the first-run checklist shows and nothing qualifies. */
export const CATALOG_DISABLED_REASON = 'Cargá una variedad con precio y su stock'

export const PRICE_PER_GRAM_HELP = 'Por gramo, en pesos enteros'
export const PRICE_DISCOUNT_HELP = 'Opcional · menor al precio de lista'
export const PRICE_FROM_GRAMS_HELP = 'Desde cuántos gramos aplica'
export const VARIETY_NAME_HELP = 'Hasta 60 caracteres · no puede repetir el nombre de otra variedad'

/** A toast, not always-visible copy, so it is not in `LIMITED_COPY`. */
export const PRICE_SAVED = 'Precio guardado'

export const THRESHOLD_INVALID_MESSAGE = 'Revisá el umbral cargado'
export const THRESHOLD_SAVED: SuccessToast = 'Aviso guardado'

export const THRESHOLD_OVERRIDES: Partial<Record<RefusalCode, string>> = {
  'stock.threshold_invalid': THRESHOLD_INVALID_MESSAGE,
}

/** Still the Spanish the app had: the Spanish rule (`architecture/copySpanish.ts`) skips a
 * section that says so. Removed with the section's English wording (ADR-0048). */
export const PENDING = true

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyTitle', text: EMPTY_TITLE },
  { kind: 'emptyLine', text: EMPTY_DETAIL },
  { kind: 'emptyTitle', text: NO_ARCHIVED_MESSAGE },
  { kind: 'help', text: PRICE_HISTORY_HELP },
  { kind: 'help', text: CATALOG_DISABLED_REASON },
  { kind: 'help', text: PRICE_PER_GRAM_HELP },
  { kind: 'help', text: PRICE_DISCOUNT_HELP },
  { kind: 'help', text: PRICE_FROM_GRAMS_HELP },
  { kind: 'help', text: VARIETY_NAME_HELP },
]
export const LONG_REFUSALS: readonly string[] = []
