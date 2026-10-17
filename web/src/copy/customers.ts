/**
 * The fixed always-visible words of the Clientes screens (no JSX): their empty states, the
 * same bindings the screens render. Registered in `LIMITED_COPY` so
 * `copy/copyLimits.test.ts` measures them against the limit of the icon and text rule
 * (docs/product/icon-and-text-rule.md).
 */

import { NOBODY_OWES } from './common'
import type { LimitedCopy } from './limits'

/** Clientes' empty list. */
export const EMPTY_CUSTOMERS = 'Todavía no agregaste ningún cliente.'
/** Heads everyone A–Z, under "Te deben" (`Clientes.dc.html`). */
export const EVERYONE = 'Todos · A–Z'

/** Still the Spanish the app had: the Spanish rule (`architecture/copySpanish.ts`) skips a
 * section that says so. Removed with the section's English wording (ADR-0048). */
export const PENDING = true

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyTitle', text: EMPTY_CUSTOMERS },
  { kind: 'emptyTitle', text: NOBODY_OWES },
]
export const LONG_REFUSALS: readonly string[] = []
