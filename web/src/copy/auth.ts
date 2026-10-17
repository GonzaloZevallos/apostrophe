/**
 * Copy the getting-in screens share (ADR-0025). A screen never imports a message
 * constant from another screen: what two of them say lives here.
 */

import { SAMPLES, type LimitedCopy } from './limits'

export const WEAK_PASSWORD_MESSAGE = 'La contraseña tiene que tener al menos 10 caracteres'
export const DEAD_LINK_MESSAGE = 'Este enlace ya no sirve. Pedile uno nuevo a quien te lo pasó.'
export const BRAKE_MESSAGE = '5 intentos fallidos · probá de nuevo en 15 minutos'
export const LOGIN_HINT = 'Después de 5 intentos fallidos, el email queda bloqueado 15 minutos'
export const INVITE_ONLY_LINE = 'Para usar apostrophe te tiene que invitar un negocio.'
export const expiryLine = (isNewBusiness: boolean, expiry: string): string =>
  isNewBusiness
    ? `La invitación se usa una sola vez y vence el ${expiry}.`
    : `Esta invitación vence el ${expiry} y se usa una sola vez.`
export const NOT_USABLE_TITLE = 'Esta invitación ya no sirve'
export const NOT_USABLE_DETAIL = 'Venció o alguien la usó antes. Pedile al negocio que te manden una nueva.'

/** The always-visible notices here, measured by `copy/copyLimits.test.ts`. The weak-password
 * refusal stays out: it is an inline refusal, aimed at 80 and kept with its fix. */
export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'notice', text: DEAD_LINK_MESSAGE },
  { kind: 'notice', text: BRAKE_MESSAGE },
  { kind: 'help', text: LOGIN_HINT },
  { kind: 'help', text: INVITE_ONLY_LINE },
  { kind: 'help', text: expiryLine(true, SAMPLES.date) },
  { kind: 'help', text: expiryLine(false, SAMPLES.date) },
  { kind: 'notice', text: NOT_USABLE_TITLE },
  { kind: 'notice', text: NOT_USABLE_DETAIL },
]
export const LONG_REFUSALS: readonly string[] = []
