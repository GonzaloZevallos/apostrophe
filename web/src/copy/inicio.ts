/**
 * The fixed copy of Inicio's notices and empty state, registered for
 * `copy/copyLimits.test.ts`. `Inicio.tsx` renders these same bindings.
 */

import type { LimitedCopy } from './limits.ts'
import { COMMON_TEXT } from './common.ts'

export const LANGUAGE: 'es' | 'en' = 'en'

export const EMPTY_TITLE = 'Start with your varieties'
export const EMPTY_DETAIL = 'Add your first variety with its price. Without a price it cannot be sold.'
/** Shown in the Te deben block; Clientes' own copy of this line is `customers.NOBODY_OWES` (group c moves both to payments). */
export const NOBODY_OWES = 'Nobody owes you'
export const PINNED_CATALOG_OUT_OF_DATE = 'Your Telegram catalog is out of date'

export const CHECKLIST_TITLE = 'To get started'
export const CHECKLIST_REQUIRED = 'Required'
export const CHECKLIST_OPTIONAL = 'Optional'
export const CHECKLIST_DONE = COMMON_TEXT.done
export const STEP_PRICED_VARIETY = 'Add a variety with its price'
export const STEP_STOCK_ENTRY = 'Add what you have today'
export const STEP_PUBLISHED = 'Connect the bot'
export const STEP_SECOND_USER = 'Invite a partner'
export const IMPORT_NOTICE = 'Connect the bot so the pinned catalog updates by itself'
export const IMPORT_NOTICE_DISMISS = 'Dismiss notice'
/** The line under "+ Nueva venta" while the checklist shows and no variety has a price. */
export const NUEVA_VENTA_MISSING = 'Add a price to a variety so you can sell'

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
  loQueTeQueda: 'What you have left',
  desde0: (oldest: string | number) => `since ${oldest}`,
  sinceDate: (owing_since: string | number) => ` · since ${owing_since}`,
  vendisteHoy: 'You sold today',
  vendisteEstaSemana: 'You sold this week',
  vendisteEsteMes: 'You sold this month',
  regalaste: 'You gave away',
  n0Promedio12: (count: string | number, average_sale: string | number, grams: string | number) => `${count} · average ${average_sale} · ${grams}`,
  pendingCostNote: 'includes pending cost',
} as const
