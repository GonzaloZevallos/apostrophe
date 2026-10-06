/**
 * The fixed words the business, users, account and catalog-message groups share with their tests (no JSX).
 * Toasts are typed on `SuccessToast`, so an invented message fails `tsc`. The generic retry
 * is not here: its one home is `ERROR_GENERICO_MENSAJE` in `components/ErrorGenerico`.
 */

import type { SuccessToast } from '../../components/AvisoExito'

export const RENAME_SUCCESS: SuccessToast = 'Negocio renombrado'
export const PASSWORD_CHANGED_SUCCESS: SuccessToast = 'Contraseña cambiada · cerramos tus otras sesiones'
export const BUSINESS_NAME_INVALID_MESSAGE = 'Ponele un nombre al negocio, sin espacios de más'
export const GENERIC_REFUSAL_MESSAGE = 'Revisá los datos e intentá de nuevo.'
export const CATALOG_SAVED: SuccessToast = 'Catálogo guardado'
export const HEADER_TOO_LONG_MESSAGE = 'El encabezado es demasiado largo'
export const FOOTER_TOO_LONG_MESSAGE = 'El pie es demasiado largo'
