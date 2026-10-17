/**
 * The fixed words of the catalog screen that are always on screen, shared with its test
 * (no JSX): its empty state and the always-visible lines of the pin's status card
 * (`PinPublish`). Listed in `LIMITED_COPY` so `copy/copyLimits.test.ts` measures the very
 * bindings `Catalogo` and `PinPublish` render: each "Desactualizado" reason (`refusals.ts`
 * owns the sentences, the server's reasons worded once) and the two lines that say why
 * Publicar is blocked, with the link word the screen draws at their end.
 */

import {
  PINNED_CATALOG_NOT_READY_REASON,
  PINNED_CATALOG_REASON_LABEL,
  type PinReason,
} from './refusals'
import type { LimitedCopy } from './limits'

export const EMPTY_STATE_TITLE = 'No hay nada en el catálogo hoy'
export const EMPTY_STATE_DETAIL = 'No hay nada para copiar todavía'

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
  { kind: 'emptyTitle', text: EMPTY_STATE_TITLE },
  { kind: 'emptyLine', text: EMPTY_STATE_DETAIL },
  ...Object.values(OUT_OF_DATE_LINES)
    .filter((text) => text !== OUT_OF_DATE_TOO_LONG_LINE)
    .map((text): LimitedCopy => ({ kind: 'notice', text })),
  { kind: 'help', text: NOT_READY_LINE },
  { kind: 'help', text: CHANNEL_MISSING_LINE },
]
export const LONG_REFUSALS: readonly string[] = [OUT_OF_DATE_TOO_LONG_LINE]
