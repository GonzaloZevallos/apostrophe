/**
 * The always-visible lines of the pin's status card on the catalog screen (`PinPublish`),
 * shared with its test (no JSX). Listed in `LIMITED_COPY` as the same bindings the screen
 * renders: each "Desactualizado" reason (`api/refusals.ts` owns the sentences, the
 * server's reasons worded once) and the two lines that say why Publicar is blocked, with
 * the link word the screen draws at their end. `copy/copyLimits.test.ts` measures them.
 */

import { PINNED_CATALOG_NOT_READY_REASON, PINNED_CATALOG_REASON_LABEL } from '../api/refusals'
import type { LimitedCopy } from '../copy/limits'

/** The word of the link to Configuración → Integraciones that ends both blocked lines. */
export const INTEGRATIONS_LINK_WORD = 'Integraciones'
export const CHANNEL_MISSING_LEAD = 'Falta el canal: cargalo en '

export const NOT_READY_LINE = `${PINNED_CATALOG_NOT_READY_REASON} · ${INTEGRATIONS_LINK_WORD}`
export const CHANNEL_MISSING_LINE = `${CHANNEL_MISSING_LEAD}${INTEGRATIONS_LINK_WORD}`

export const LIMITED_COPY: readonly LimitedCopy[] = [
  ...Object.values(PINNED_CATALOG_REASON_LABEL).map((text): LimitedCopy => ({ kind: 'notice', text })),
  { kind: 'help', text: NOT_READY_LINE },
  { kind: 'help', text: CHANNEL_MISSING_LINE },
]
export const LONG_REFUSALS: readonly string[] = []
