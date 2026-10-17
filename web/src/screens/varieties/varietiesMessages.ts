/** The fixed Spanish of the varieties list, Archivadas and the whole price history that is
 * always on screen: the empty states and the one help line. Each is a binding the screen
 * renders, listed in `LIMITED_COPY` with its kind (`copy/copyLimits.test.ts` measures it). */

import type { LimitedCopy } from '../../copy/limits'

export const EMPTY_TITLE = 'Todavía no cargaste ninguna variedad'
export const EMPTY_DETAIL = 'Agregá la primera con su precio para poder vender y mandar tu catálogo.'
export const NO_ARCHIVED_MESSAGE = 'No tenés variedades archivadas'
export const PRICE_HISTORY_HELP = 'Cada venta usa el precio que regía ese día, aunque lo cambies después.'
/** Why "Mandar catálogo" is disabled, only while the first-run checklist shows and nothing qualifies. */
export const CATALOG_DISABLED_REASON = 'Cargá una variedad con precio y su stock'

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyTitle', text: EMPTY_TITLE },
  { kind: 'emptyLine', text: EMPTY_DETAIL },
  { kind: 'emptyTitle', text: NO_ARCHIVED_MESSAGE },
  { kind: 'help', text: PRICE_HISTORY_HELP },
  { kind: 'help', text: CATALOG_DISABLED_REASON },
]
export const LONG_REFUSALS: readonly string[] = []
