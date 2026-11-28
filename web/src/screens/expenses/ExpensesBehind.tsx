/**
 * What sits behind the expense form on a phone, on a direct address (ADR-0062; navigation.md's
 * "Expense form, new → Expenses"): the month Expenses opens on, from the screen's own query key, so
 * opened from inside the app it is already cached and a direct address costs the one GET Expenses
 * would have made. It draws only from resolved data: while pending and on any error it is empty,
 * with no skeleton and no wording (the form route keeps its own errors). It draws the screen's
 * title row through `ExpensesTitleRow`, round back and Add expense included, so the title does not
 * shift under the sheet; they are reachable by no one, only inside the Sheet's inert background
 * (ADR 20261125, ADR-0027). It shares `MonthBody` with the screen, and draws no `h1` and no ids.
 */

import { useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router'
import { monthlyView } from '../../api/expenses'
import { keys } from '../../api/keys'
import type { Me } from '../../api/me'
import { formatMonthLong } from '../../format/dates'
import ExpensesTitleRow from './ExpensesTitleRow'
import MonthBody from './MonthBody'

export default function ExpensesBehind() {
  const me = useOutletContext<Me>()
  const month = me.today.slice(0, 7)
  const { data } = useQuery({ queryKey: keys.expenses(month), queryFn: () => monthlyView(month), retry: false })

  if (data === undefined) return null

  return (
    <div className="pantalla">
      <div className="cuerpo gastos">
        <ExpensesTitleRow
          month={
            <div className="gastos__mes">
              <span className="gastos__mes-etiqueta">{formatMonthLong(month)}</span>
            </div>
          }
        />
        <MonthBody view={data} today={me.today} />
      </div>
    </div>
  )
}
