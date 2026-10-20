/**
 * The fixed copy of Inicio's notices and empty state, registered for
 * `copy/copyLimits.test.ts`. `Inicio.tsx` renders these same bindings.
 */

import type { LimitedCopy } from './limits'
import { EMPTY_STATES } from './emptyStates'

export const LANGUAGE: 'es' | 'en' = 'es'

export const EMPTY_TITLE = EMPTY_STATES.homeVarietiesTitle
export const EMPTY_DETAIL = EMPTY_STATES.homeVarietiesDetail
export const NOBODY_OWES = EMPTY_STATES.homeNobodyOwes
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

/** Every text a person reads in this area that is not a named message above, by key. */
export const INICIO_TEXT = {
  inicio: 'Inicio',
  loQueTeQueda: 'Lo que te queda',
  desde0: (oldest: string | number) => `desde ${oldest}`,
  desde02: (owing_since: string | number) => ` · desde ${owing_since}`,
  vendisteHoy: 'Vendiste hoy',
  vendisteEstaSemana: 'Vendiste esta semana',
  vendisteEsteMes: 'Vendiste este mes',
  regalaste: 'Regalaste',
  comprasDeFlores: 'Compras de flores',
  n0Promedio12: (count: string | number, average_sale: string | number, grams: string | number) => `${count} · promedio ${average_sale} · ${grams}`,
} as const
