/**
 * `MonthBody`: what Expenses shows of a resolved month (the total, the categories, the latest
 * expenses). The screen and the sheet's behind-pane (`ExpensesBehind`) both draw it, so the pane
 * cannot drift from its parent (ADR-0062). `onEdit` is the screen's; the pane gives none.
 */

import type { Expense, MonthlyView } from '../../api/expenses'
import { formatDate } from '../../format/dates'
import { formatMoney } from '../../format/money'
import { EXPENSES_TEXT } from '../../copy/expenses'

function countLine(expenses: number, categories: number): string {
  const spent = expenses === 1 ? EXPENSES_TEXT.expenseOne : EXPENSES_TEXT.expenseMany(expenses)
  const inCategories = categories === 1 ? EXPENSES_TEXT.oneCategory : EXPENSES_TEXT.categoriesCount(categories)
  return EXPENSES_TEXT.expenseCountIn(spent, inCategories)
}

export interface MonthBodyProps {
  view: MonthlyView
  today: string
  onEdit?: (expense: Expense) => void
}

export default function MonthBody({ view, today, onEdit }: MonthBodyProps) {
  const latest = view.categories
    .flatMap((category) => category.expenses.map((expense) => ({ expense, categoryName: category.name })))
    // ISO dates (YYYY-MM-DD) order as text; `<` and `>` do not read the device locale.
    .sort((a, b) => {
      if (b.expense.spent_on < a.expense.spent_on) return -1
      if (b.expense.spent_on > a.expense.spent_on) return 1
      return b.expense.id - a.expense.id
    })

  return (
    <>
      <div className="gastos__resumen">
        <div className="gastos__total">
          <span className="rotulo">{EXPENSES_TEXT.youSpentThisMonth}</span>
          <span className="cifra-xl">{formatMoney(view.total)}</span>
          {latest.length > 0 && (
            <span className="gastos__conteo">{countLine(latest.length, view.categories.length)}</span>
          )}
        </div>
        {view.categories.length > 0 && (
          <>
            <span className="gastos__seccion">{EXPENSES_TEXT.byCategory}</span>
            <div className="gastos__categorias">
              {view.categories.map((category) => (
                <div key={category.id} className="gastos__categoria">
                  <div className="gastos__categoria-cabecera">
                    <span className="gastos__categoria-nombre">{category.name}</span>
                    <span className="gastos__categoria-subtotal">{formatMoney(category.subtotal)}</span>
                  </div>
                  <span className="gastos__barra" aria-hidden="true">
                    <span
                      className="gastos__barra-relleno"
                      style={{ width: `${Math.round((category.subtotal / view.total) * 100)}%` }}
                    />
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {latest.length > 0 && (
        <div className="gastos__ultimos">
          <span className="gastos__seccion">{EXPENSES_TEXT.latest}</span>
          {latest.map(({ expense, categoryName }) => (
            <button
              key={expense.id}
              type="button"
              className="fila-gasto"
              tabIndex={onEdit === undefined ? -1 : undefined}
              onClick={onEdit === undefined ? undefined : () => onEdit(expense)}
            >
              <span className="fila-gasto__fecha">{formatDate(expense.spent_on, today)}</span>
              <span className="fila-gasto__cuerpo">
                <span className="fila-gasto__categoria">{categoryName}</span>
                <span className="fila-gasto__texto">{expense.detail}</span>
              </span>
              <span className="fila-gasto__monto">{formatMoney(expense.amount)}</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
