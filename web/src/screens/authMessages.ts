/**
 * Copy the getting-in screens share (ADR-0025). A screen never imports a message
 * constant from another screen: what two of them say lives here.
 */

import type { LimitedCopy } from '../copy/limits'

export const WEAK_PASSWORD_MESSAGE = 'La contraseña tiene que tener al menos 10 caracteres'
export const DEAD_LINK_MESSAGE = 'Este enlace ya no sirve. Pedile uno nuevo a quien te lo pasó.'
export const BRAKE_MESSAGE = '5 intentos fallidos · probá de nuevo en 15 minutos'

/** The always-visible notices here, measured by `copy/copyLimits.test.ts`. The weak-password
 * refusal stays out: it is an inline refusal, aimed at 80 and kept with its fix. */
export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'notice', text: DEAD_LINK_MESSAGE },
  { kind: 'notice', text: BRAKE_MESSAGE },
]
export const LONG_REFUSALS: readonly string[] = []
