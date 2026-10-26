/**
 * What sits behind the expense form on a phone, on a direct address (ADR-0053; navigation.md's
 * "Expense form, new → Expenses"): the month Expenses opens on, from the screen's own query key, so
 * opened from inside the app it is already cached and a direct address costs the one GET Expenses
 * would have made. It draws only from resolved data: while pending and on any error it is empty,
 * with no skeleton and no wording (the form route keeps its own errors). It keeps the screen's
 * heading and month line so the page does not shift under the sheet, and shares `MonthBody` with the
 * screen. It draws no chrome, no `h1` and no ids.
 */

import { useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router'
import { monthlyView } from '../../api/expenses'
import { keys } from '../../api/keys'
import type { Me } from '../../api/me'
import { formatMonthLong } from '../../format/dates'
import { COMMON_TEXT } from '../../copy/common'
import MonthBody from './MonthBody'

export default function ExpensesBehind() {
  const me = useOutletContext<Me>()
  const month = me.today.slice(0, 7)
  const { data } = useQuery({ queryKey: keys.expenses(month), queryFn: () => monthlyView(month), retry: false })

  if (data === undefined) return null

  return (
    <div className="pantalla">
      <div className="cuerpo gastos">
        <div className="gastos__cabecera">
          <span className="encabezado__titulo gastos__titulo">{COMMON_TEXT.expenses}</span>
          <div className="gastos__mes">
            <span className="gastos__mes-etiqueta">{formatMonthLong(month)}</span>
          </div>
        </div>
        <MonthBody view={data} today={me.today} />
      </div>
    </div>
  )
}
