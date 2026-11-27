/**
 * Expenses' title row on the phone (`Gastos.dc.html`, ADR 20261125): the round back to Analysis,
 * the title and "Add expense" on one line that never wraps, then the month line as its own line
 * below. `Gastos` and `ExpensesBehind` (the screen behind the New expense Sheet) both draw it, so
 * the title sits in the same place under the Sheet as on the screen. The two narrow steps (the
 * pill to the round icon, the back to the round chevron) are CSS `@container` rules on the row
 * (`.gastos__fila-titulo`); the title itself is never wrapped, shrunk or cut. The computer keeps
 * `Gastos`' own `gastos__cabecera`.
 */

import type { ReactNode } from 'react'
import InAppLink from '../../components/InAppLink'
import Icono from '../../components/Icono'
import { COMMON_TEXT } from '../../copy/common'
import { EXPENSE_NEW } from '../../routes'
import BackArrow from '../../shell/BackArrow'

export default function ExpensesTitleRow({ month }: { month: ReactNode }) {
  return (
    <div className="gastos__encabezado">
      <div className="gastos__fila-titulo">
        <BackArrow id="expenses" look="round" />
        <span className="encabezado__titulo gastos__titulo">{COMMON_TEXT.expenses}</span>
        <InAppLink to={EXPENSE_NEW} className="gastos__cargar" aria-label={COMMON_TEXT.addExpense}>
          <Icono nombre="agregar" />
          <span className="gastos__cargar-texto">{COMMON_TEXT.addExpense}</span>
        </InAppLink>
      </div>
      {month}
    </div>
  )
}
