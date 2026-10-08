/**
 * The fixed always-visible words of the Clientes screens (no JSX): their empty states, the
 * same bindings the screens render. Registered in `LIMITED_COPY` so
 * `copy/copyLimits.test.ts` measures them against the limit of the icon and text rule
 * (docs/product/icon-and-text-rule.md).
 */

import type { LimitedCopy } from '../../copy/limits'

/** Clientes' empty list. */
export const EMPTY_CUSTOMERS = 'Todavía no agregaste ningún cliente.'
/** "Te deben" with nobody owing. */
export const NOBODY_OWES = 'Nadie te debe.'

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyTitle', text: EMPTY_CUSTOMERS },
  { kind: 'emptyTitle', text: NOBODY_OWES },
]
export const LONG_REFUSALS: readonly string[] = []
