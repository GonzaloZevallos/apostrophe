/**
 * The success toast (`componentes.ts`'s `Aviso`, `Estados.dc.html` "Avisos al
 * guardar"): one of the PRD's fixed strings, never a name, a phone number or an
 * amount (plan, invariants). `texto` is typed on the closed union so a screen
 * cannot toast anything else.
 */

import type { EXPENSES_TEXT } from '../copy/expenses'
import type { SETTINGS_TEXT } from '../copy/settings'

export type SuccessToast =
  | (typeof EXPENSES_TEXT)['expenseSaved']
  | (typeof EXPENSES_TEXT)['expenseDeleted']
  | (typeof SETTINGS_TEXT)['categorySaved']
  | (typeof SETTINGS_TEXT)['categoryDeleted']

export default function Aviso({ texto }: { texto: SuccessToast }) {
  return (
    <div className="aviso-flotante">
      <div className="aviso-toast" role="status">
        <span className="aviso-toast__texto">{texto}</span>
      </div>
    </div>
  )
}
