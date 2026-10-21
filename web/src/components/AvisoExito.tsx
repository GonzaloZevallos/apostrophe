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
import type { EXPENSES_TEXT } from '../copy/expenses'
import type { PINNED_CATALOG_TEXT } from '../copy/pinnedCatalog'
import type {
  CATALOG_SAVED,
  PASSWORD_CHANGED_SUCCESS,
  PRICES_SAVED,
  RENAME_SUCCESS,
  SETTINGS_TEXT,
} from '../copy/settings'
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
  | (typeof EXPENSES_TEXT)['expenseSaved']
  | (typeof EXPENSES_TEXT)['expenseDeleted']
  | (typeof SETTINGS_TEXT)['categorySaved']
  | (typeof SETTINGS_TEXT)['categoryDeleted']
  | typeof RENAME_SUCCESS
  | typeof PASSWORD_CHANGED_SUCCESS
  | (typeof SETTINGS_TEXT)['invitationReady']
  | 'Cliente asignado'
  | 'Aviso guardado'
  | typeof CATALOG_SAVED
  | typeof PRICES_SAVED
  | 'Catálogo copiado'
  | 'Cobro eliminado'
  | 'Cobro guardado'
  | `Cobro guardado · queda debiendo ${string}`
  | (typeof SETTINGS_TEXT)['testSent']
  | (typeof PINNED_CATALOG_TEXT)['catalogPublished']
  | 'Retiro guardado'
  | 'Retiro eliminado'

export default function AvisoExito({ texto }: { texto: SuccessToast }) {
  return (
    <div className="aviso-exito" role="status">
      <span className="aviso-exito__texto">{texto}</span>
    </div>
  )
}
