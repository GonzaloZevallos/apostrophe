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
import type { PRICE_SAVED, THRESHOLD_SAVED, VARIETIES_TEXT } from '../copy/varieties'
import type { STOCK_TEXT } from '../copy/stock'
import type { CATALOG_TEXT } from '../copy/catalog'

export type SuccessToast =
  | (typeof COMMON_TEXT)['customerSaved']
  | (typeof COMMON_TEXT)['entrySaved']
  | (typeof COMMON_TEXT)['entryDeleted']
  | (typeof VARIETIES_TEXT)['variedadGuardada']
  | (typeof VARIETIES_TEXT)['variedadEliminada']
  | (typeof VARIETIES_TEXT)['variedadArchivada']
  | (typeof VARIETIES_TEXT)['variedadRestaurada']
  | typeof PRICE_SAVED
  | (typeof VARIETIES_TEXT)['precioEliminado']
  | 'Gasto guardado'
  | 'Gasto eliminado'
  | 'Categoría guardada'
  | 'Categoría eliminada'
  | 'Negocio renombrado'
  | 'Contraseña cambiada · cerramos tus otras sesiones'
  | 'Invitación lista'
  | 'Cliente asignado'
  | typeof THRESHOLD_SAVED
  | 'Catálogo guardado'
  | 'Precios guardados'
  | (typeof CATALOG_TEXT)['catalogoCopiado']
  | 'Cobro eliminado'
  | 'Cobro guardado'
  | `Cobro guardado · queda debiendo ${string}`
  | 'Prueba enviada'
  | 'Catálogo publicado'
  | (typeof STOCK_TEXT)['retiroGuardado']
  | (typeof STOCK_TEXT)['retiroEliminado']

export default function AvisoExito({ texto }: { texto: SuccessToast }) {
  return (
    <div className="aviso-exito" role="status">
      <span className="aviso-exito__texto">{texto}</span>
    </div>
  )
}
