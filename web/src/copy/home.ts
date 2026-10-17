/**
 * The fixed copy of Inicio's notices and empty state, registered for
 * `copy/copyLimits.test.ts`. `Inicio.tsx` renders these same bindings.
 */

import { NOBODY_OWES } from './common'
import type { LimitedCopy } from './limits'

export const EMPTY_TITLE = 'Arrancá por las variedades'
export const EMPTY_DETAIL = 'Cargá tu primera variedad con su precio. Sin precio no se puede vender.'
export const PINNED_CATALOG_OUT_OF_DATE = 'Tu catálogo en Telegram está desactualizado'

export const CHECKLIST_TITLE = 'Para arrancar'
export const CHECKLIST_REQUIRED = 'Obligatorio'
export const CHECKLIST_OPTIONAL = 'Opcional'
export const CHECKLIST_DONE = 'Hecho'
export const STEP_PRICED_VARIETY = 'Cargá una variedad con su precio'
export const STEP_STOCK_ENTRY = 'Cargá lo que tenés hoy'
export const STEP_PUBLISHED = 'Conectá el bot'
export const STEP_SECOND_USER = 'Invitá a un socio'
export const IMPORT_NOTICE = 'Conectá el bot para que el catálogo fijado se actualice solo'
export const IMPORT_NOTICE_DISMISS = 'Descartar aviso'
/** The line under "+ Nueva venta" while the checklist shows and no variety has a price. */
export const NUEVA_VENTA_MISSING = 'Cargale un precio a una variedad para poder vender'

/** Still the Spanish the app had: the Spanish rule (`architecture/copySpanish.ts`) skips a
 * section that says so. Removed with the section's English wording (ADR-0048). */
export const PENDING = true

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyTitle', text: EMPTY_TITLE },
  { kind: 'emptyLine', text: EMPTY_DETAIL },
  { kind: 'emptyTitle', text: NOBODY_OWES },
  { kind: 'notice', text: PINNED_CATALOG_OUT_OF_DATE },
  { kind: 'notice', text: IMPORT_NOTICE },
  { kind: 'help', text: NUEVA_VENTA_MISSING },
  { kind: 'help', text: STEP_PRICED_VARIETY },
  { kind: 'help', text: STEP_STOCK_ENTRY },
  { kind: 'help', text: STEP_PUBLISHED },
  { kind: 'help', text: STEP_SECOND_USER },
]
export const LONG_REFUSALS: readonly string[] = []
