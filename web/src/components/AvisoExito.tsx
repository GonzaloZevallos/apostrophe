/**
 * A success toast (PRD, "Feedback": a fixed string from the closed union, never
 * "Deshacer"). Blue, never green (accessibility rule: blue ↔ amber only) — `--acento`,
 * the same accent the rest of the app uses, not a state color of its own.
 *
 * A toast that is a `common:` key (`feedback.ts`'s `SuccessToast`) is resolved with `t`.
 *
 * `SuccessToast` is the PRD's own closed union ("Feedback": the full list of fixed
 * toasts) — every screen's toast state is typed on it, not on a bare `string`, so a
 * typo or an invented message fails `tsc` instead of rendering silently.
 */

import { useTranslation } from 'react-i18next'
import type { CUSTOMERS_TEXT } from '../copy/customers'
import type { EXPENSES_TEXT } from '../copy/expenses'
import type { PAYMENTS_TEXT } from '../copy/payments'
import type { PINNED_CATALOG_TEXT } from '../copy/pinnedCatalog'
import type { SALES_TEXT } from '../copy/sales'
import type {
  CATALOG_SAVED,
  PASSWORD_CHANGED_SUCCESS,
  PRICES_SAVED,
  RENAME_SUCCESS,
  SETTINGS_TEXT,
} from '../copy/settings'
import type { PRICE_SAVED, THRESHOLD_SAVED, VARIETIES_TEXT } from '../copy/varieties'
import type { STOCK_TEXT } from '../copy/stock'
import type { CATALOG_TEXT } from '../copy/catalog'
import { isSuccessToast } from './feedback'

export type SuccessToast =
  | 'common:customerSaved'
  | 'common:entrySaved'
  | 'common:entryDeleted'
  | (typeof VARIETIES_TEXT)['variedadGuardada']
  | (typeof VARIETIES_TEXT)['variedadEliminada']
  | (typeof VARIETIES_TEXT)['variedadArchivada']
  | (typeof VARIETIES_TEXT)['variedadRestaurada']
  | typeof PRICE_SAVED
  | (typeof VARIETIES_TEXT)['precioEliminado']
  | (typeof EXPENSES_TEXT)['expenseSaved']
  | (typeof EXPENSES_TEXT)['expenseDeleted']
  | (typeof SETTINGS_TEXT)['categorySaved']
  | (typeof SETTINGS_TEXT)['categoryDeleted']
  | typeof RENAME_SUCCESS
  | typeof PASSWORD_CHANGED_SUCCESS
  | (typeof SETTINGS_TEXT)['invitationReady']
  | (typeof SALES_TEXT)['customerAssigned']
  | typeof THRESHOLD_SAVED
  | typeof CATALOG_SAVED
  | typeof PRICES_SAVED
  | (typeof CATALOG_TEXT)['catalogoCopiado']
  | (typeof CUSTOMERS_TEXT)['paymentDeleted']
  | (typeof PAYMENTS_TEXT)['saved']
  | ReturnType<(typeof PAYMENTS_TEXT)['savedStillOwing']>
  | (typeof SETTINGS_TEXT)['testSent']
  | (typeof PINNED_CATALOG_TEXT)['catalogPublished']
  | (typeof STOCK_TEXT)['retiroGuardado']
  | (typeof STOCK_TEXT)['retiroEliminado']

export default function AvisoExito({ texto }: { texto: SuccessToast }) {
  const { t } = useTranslation()
  // A `common:` key is resolved here; the area toasts below it in the union are still
  // their English words until their area part moves them to keys.
  return (
    <div className="aviso-exito" role="status">
      <span className="aviso-exito__texto">{isSuccessToast(texto) ? t(texto) : texto}</span>
    </div>
  )
}
