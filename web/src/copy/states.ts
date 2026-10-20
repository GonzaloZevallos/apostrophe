/**
 * The fixed copy of `Estados` (the no-connection notice and the generic server-error retry),
 * registered for `copy/copyLimits.test.ts`. `SinConexion` and `ErrorGenerico` render these
 * same bindings. The no-connection notice is one sentence and promises no automatic retry: the app
 * performs none (`queryClient.ts`).
 */

import { NO_CONNECTION_MESSAGE, RETRY_MESSAGE } from './common.ts'
import type { LimitedCopy } from './limits.ts'

export const SIN_CONEXION_MENSAJE = NO_CONNECTION_MESSAGE
export const ERROR_GENERICO_MENSAJE = RETRY_MESSAGE

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'notice', text: SIN_CONEXION_MENSAJE },
  { kind: 'notice', text: ERROR_GENERICO_MENSAJE },
]
export const LONG_REFUSALS: readonly string[] = []
