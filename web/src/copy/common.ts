/**
 * The words two or more sections say, defined once here and imported by the sections that
 * use them (ADR-0025: a screen never imports a message from another screen). A section
 * never copies a value this file owns.
 */

import type { LimitedCopy } from './limits'

/** "Te deben" with nobody owing: Clientes' list and Inicio's panel. */
export const NOBODY_OWES = 'Nadie te debe'

/** The refusal of a form whose fields the API refused without a field of its own. */
export const GENERIC_REFUSAL_MESSAGE = 'Revisá los datos e intentá de nuevo.'

/** Still the Spanish the app had: the Spanish rule (`architecture/copySpanish.ts`) skips a
 * section that says so. Removed with the section's English wording (ADR-0048). */
export const PENDING = true

export const LIMITED_COPY: readonly LimitedCopy[] = [{ kind: 'emptyTitle', text: NOBODY_OWES }]
export const LONG_REFUSALS: readonly string[] = []
