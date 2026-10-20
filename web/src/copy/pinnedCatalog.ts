/**
 * The always-visible lines of the pin's status card on the catalog screen (`PinPublish`),
 * shared with its test (no JSX). Listed in `LIMITED_COPY` as the same bindings the screen
 * renders: each "Desactualizado" reason (`api/refusals.ts` owns the sentences, the
 * server's reasons worded once) and the two lines that say why Publicar is blocked, with
 * the link word the screen draws at their end. `copy/copyLimits.test.ts` measures them.
 */

import {
  PINNED_CATALOG_NOT_READY_REASON,
  PINNED_CATALOG_REASON_LABEL,
  type PinReason,
} from '../api/refusals'
import type { LimitedCopy } from './limits'

/** The word of the link to Configuración → Integraciones that ends both blocked lines. */
export const INTEGRATIONS_LINK_WORD = 'Integraciones'
export const CHANNEL_MISSING_LEAD = 'Falta el canal: cargalo en '

export const NOT_READY_LINE = `${PINNED_CATALOG_NOT_READY_REASON} · ${INTEGRATIONS_LINK_WORD}`
export const CHANNEL_MISSING_LINE = `${CHANNEL_MISSING_LEAD}${INTEGRATIONS_LINK_WORD}`

/** The title of the status line when the pin is behind; the reason follows it. */
export const OUT_OF_DATE_TITLE = 'Desactualizado'
export const OUT_OF_DATE_SEPARATOR = ' · '

/** The notice as the seller reads it, "Desactualizado · <reason>", one per reason: the
 * length is measured on this, never on the bare reason. `too_long` carries its fix (the
 * seller must shorten the catalog) and is the one over 80, so it is a named export listed
 * in `LONG_REFUSALS` instead of a `notice`. */
export const OUT_OF_DATE_TOO_LONG_LINE = `${OUT_OF_DATE_TITLE}${OUT_OF_DATE_SEPARATOR}${PINNED_CATALOG_REASON_LABEL.too_long}`
export const OUT_OF_DATE_LINES: Record<PinReason, string> = {
  telegram_unreachable: `${OUT_OF_DATE_TITLE}${OUT_OF_DATE_SEPARATOR}${PINNED_CATALOG_REASON_LABEL.telegram_unreachable}`,
  bot_cannot_post: `${OUT_OF_DATE_TITLE}${OUT_OF_DATE_SEPARATOR}${PINNED_CATALOG_REASON_LABEL.bot_cannot_post}`,
  message_gone: `${OUT_OF_DATE_TITLE}${OUT_OF_DATE_SEPARATOR}${PINNED_CATALOG_REASON_LABEL.message_gone}`,
  missing_publish: `${OUT_OF_DATE_TITLE}${OUT_OF_DATE_SEPARATOR}${PINNED_CATALOG_REASON_LABEL.missing_publish}`,
  too_long: OUT_OF_DATE_TOO_LONG_LINE,
}

export const LIMITED_COPY: readonly LimitedCopy[] = [
  ...Object.values(OUT_OF_DATE_LINES)
    .filter((text) => text !== OUT_OF_DATE_TOO_LONG_LINE)
    .map((text): LimitedCopy => ({ kind: 'notice', text })),
  { kind: 'help', text: NOT_READY_LINE },
  { kind: 'help', text: CHANNEL_MISSING_LINE },
]
export const LONG_REFUSALS: readonly string[] = [OUT_OF_DATE_TOO_LONG_LINE]

/** Every text a person reads in this area that is not a named message above, by key. */
export const PINNED_CATALOG_TEXT = {
  alDia: 'Al día',
  elUltimoFueEl: '· El último fue el ',
  publicar: 'Publicar',
} as const
