/**
 * The fixed copy of `Estados` ("Sin conexión" and the generic server-error retry),
 * registered for `copy/copyLimits.test.ts`. `SinConexion` and `ErrorGenerico` render these
 * same bindings. "Sin conexión" is one sentence and promises no automatic retry: the app
 * performs none (`queryClient.ts`).
 */

import type { LimitedCopy } from './limits'

export const SIN_CONEXION_MENSAJE = 'Sin conexión: revisá tu internet y probá de nuevo.'
export const ERROR_GENERICO_MENSAJE = 'Algo falló. Probá de nuevo.'

/** Still the Spanish the app had: the Spanish rule (`architecture/copySpanish.ts`) skips a
 * section that says so. Removed with the section's English wording (ADR-0048). */
export const PENDING = true

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'notice', text: SIN_CONEXION_MENSAJE },
  { kind: 'notice', text: ERROR_GENERICO_MENSAJE },
]
export const LONG_REFUSALS: readonly string[] = []
