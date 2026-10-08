/**
 * The fixed copy of `Estados` ("Sin conexión" and the generic server-error retry),
 * registered for `copy/copyLimits.test.ts`. `SinConexion` and `ErrorGenerico` render these
 * same bindings and re-export them for the screens that already import them from there.
 */

import type { LimitedCopy } from '../copy/limits'

export const SIN_CONEXION_TITULO = 'Te quedaste sin internet'
export const SIN_CONEXION_DETALLE = 'apostrophe necesita conexión y reintenta solo cuando vuelva.'
export const ERROR_GENERICO_MENSAJE = 'Algo falló. Probá de nuevo.'

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'notice', text: SIN_CONEXION_TITULO },
  { kind: 'notice', text: SIN_CONEXION_DETALLE },
  { kind: 'notice', text: ERROR_GENERICO_MENSAJE },
]
export const LONG_REFUSALS: readonly string[] = []
