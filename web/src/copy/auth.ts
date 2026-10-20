/**
 * Copy the getting-in screens share (ADR-0025). A screen never imports a message
 * constant from another screen: what two of them say lives here.
 */

import { SAMPLES, type LimitedCopy } from './limits'

export const LANGUAGE: 'es' | 'en' = 'es'

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

/** Every text a person reads in this area that is not a named message above, by key. */
export const AUTH_TEXT = {
  contrasenaActual: 'Contraseña actual',
  contrasenaNueva: 'Contraseña nueva',
  cancelar: 'Cancelar',
  apostrophe: 'apostrophe',
  text: '’',
  tusVentasTuStock: 'Tus ventas, tu stock y lo que te deben.',
  email: 'Email',
  contrasena: 'Contraseña',
  entra: 'Entrá',
  armaTuNegocio: 'Armá tu negocio',
  creaElNegocio: 'Creá el negocio',
  sumateA0: (business_name: string | number | null) => `Sumate a ${business_name}`,
  entrar: 'Entrar',
  elegiTuContrasenaNueva: 'Elegí tu contraseña nueva',
  guardarYEntrar: 'Guardar y entrar',
  laContrasenaActualNo: 'La contraseña actual no es esa.',
  emailOContrasenaIncorrectos: 'Email o contraseña incorrectos',
  yaHayUnaCuenta: 'Ya hay una cuenta con ese email',
  ingresaUnEmailValido: 'Ingresá un email válido',
  invitacionValida: 'Invitación válida',
  teInvitaronA: 'Te invitaron a',
  poneleUnNombreY: 'Ponele un nombre y creá tu usuario. Después podés invitar a un socio.',
  creaTuUsuarioY: 'Creá tu usuario y vas a ver las ventas, el stock y los clientes de este negocio. Sólo de este.',
} as const
