/**
 * A success toast (PRD, "Feedback": a fixed string from the closed union, never
 * "Deshacer"). Blue, never green (accessibility rule: blue ↔ amber only) — `--acento`,
 * the same accent the rest of the app uses, not a state color of its own.
 *
 * `SuccessToast` is the PRD's own closed union ("Feedback": the full list of fixed
 * toasts) — every screen's toast state is typed on it, not on a bare `string`, so a
 * typo or an invented message fails `tsc` instead of rendering silently.
 */

import type { COMMON_TEXT } from '../copy/common'
import type { CUSTOMERS_TEXT } from '../copy/customers'
import type { PAYMENTS_TEXT } from '../copy/payments'
import type { PRICE_SAVED } from '../copy/varieties'

export type SuccessToast =
  | (typeof COMMON_TEXT)['customerSaved']
  | (typeof COMMON_TEXT)['entrySaved']
  | (typeof COMMON_TEXT)['entryDeleted']
  | 'Variedad guardada'
  | 'Variedad eliminada'
  | 'Variedad archivada'
  | 'Variedad restaurada'
  | typeof PRICE_SAVED
  | 'Precio eliminado'
  | 'Gasto guardado'
  | 'Gasto eliminado'
  | 'Categoría guardada'
  | 'Categoría eliminada'
  | 'Negocio renombrado'
  | 'Contraseña cambiada · cerramos tus otras sesiones'
  | 'Invitación lista'
  | 'Cliente asignado'
  | 'Aviso guardado'
  | 'Catálogo guardado'
  | 'Precios guardados'
  | 'Catálogo copiado'
  | (typeof CUSTOMERS_TEXT)['paymentDeleted']
  | (typeof PAYMENTS_TEXT)['saved']
  | ReturnType<(typeof PAYMENTS_TEXT)['savedStillOwing']>
  | 'Prueba enviada'
  | 'Catálogo publicado'
  | 'Retiro guardado'
  | 'Retiro eliminado'

export default function AvisoExito({ texto }: { texto: SuccessToast }) {
  return (
    <div className="aviso-exito" role="status">
      <span className="aviso-exito__texto">{texto}</span>
    </div>
  )
}
