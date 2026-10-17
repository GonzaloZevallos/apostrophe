/**
 * The step frame's two leave details, shared with its tests and registered in
 * `LIMITED_COPY` so `copy/copyLimits.test.ts` measures the very bindings the dialogs show.
 */

import type { LimitedCopy } from './limits'

export const DISCARD_DETAIL = 'Se pierde lo que escribiste: todavía no se guardó nada.'
/** For a step that has already saved part of its work: the variety is kept, the price typed is not. */
export const PARTLY_SAVED_DETAIL = 'La variedad ya quedó guardada; se pierde el precio que escribiste.'

/** Still the Spanish the app had: the Spanish rule (`architecture/copySpanish.ts`) skips a
 * section that says so. Removed with the section's English wording (ADR-0048). */
export const PENDING = true

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'help', text: DISCARD_DETAIL },
  { kind: 'help', text: PARTLY_SAVED_DETAIL },
]

export const LONG_REFUSALS: readonly string[] = []
