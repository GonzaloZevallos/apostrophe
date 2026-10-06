/**
 * Copy the getting-in screens share (ADR-0025). A screen never imports a message
 * constant from another screen: what two of them say lives here.
 */

export const WEAK_PASSWORD_MESSAGE = 'La contraseña tiene que tener al menos 10 caracteres'
export const DEAD_LINK_MESSAGE = 'Este enlace ya no sirve. Pedile uno nuevo a quien te lo pasó.'
export const BRAKE_MESSAGE = '5 intentos fallidos · probá de nuevo en 15 minutos'
