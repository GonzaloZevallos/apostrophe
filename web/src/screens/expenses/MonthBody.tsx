/**
 * `MonthBody`: what Expenses shows of a resolved month (the total, the categories, the latest
 * expenses). The screen and the sheet's behind-pane (`ExpensesBehind`) both draw it, so the pane
 * cannot drift from its parent (ADR-0062). `onEdit` is the screen's; the pane gives none.
 */

import type { Expense, MonthlyView } from '../../api/expenses'
import { formatDate } from '../../format/dates'
import { useMoney } from '../../format/moneyContext'
import { EXPENSES_TEXT } from '../../copy/expenses'
import { latestExpenses, type LatestRow } from './expensesSummary'

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

interface ExpenseRowProps {
  expense: Expense
  categoryName: string
  today: string
  onEdit?: (expense: Expense) => void
}

/** One "Latest" row: the lower line holds the detail and the method's name, only the ones there are. */
function ExpenseRow({ expense, categoryName, today, onEdit }: ExpenseRowProps) {
  const money = useMoney()
  const method = expense.payment_method
  return (
    <button
      type="button"
      className="fila-gasto"
      tabIndex={onEdit === undefined ? -1 : undefined}
      onClick={onEdit === undefined ? undefined : () => onEdit(expense)}
    >
      <span className="fila-gasto__fecha">{formatDate(expense.spent_on, today)}</span>
      <span className="fila-gasto__cuerpo">
        <span className="fila-gasto__categoria">{categoryName}</span>
        {(expense.detail !== '' || method !== null) && (
          <span className="fila-gasto__texto">
            {expense.detail !== '' && <span className="fila-gasto__detalle">{expense.detail}</span>}
            {expense.detail !== '' && method !== null && (
              <span aria-hidden="true" className="fila-gasto__separador">
                ·
              </span>
            )}
            {method !== null && <span className="fila-gasto__metodo">{method.name}</span>}
          </span>
        )}
      </span>
      <span className="fila-gasto__monto cifra-s">{money.money(expense.amount)}</span>
    </button>
  )
}

export interface MonthTotalProps {
  total: number
  expenseCount: number
  categoryCount: number
  /** False hides the count line. */
  withCount?: boolean
}

/** The month's total, with the line that counts its expenses and categories when there are any. */
export function MonthTotal({ total, expenseCount, categoryCount, withCount = true }: MonthTotalProps) {
  const money = useMoney()
  return (
    <div className="gastos__total">
      <span className="rotulo">{EXPENSES_TEXT.youSpentThisMonth}</span>
      <span className="cifra-xl">{money.money(total)}</span>
      {withCount && expenseCount > 0 && (
        <span className="gastos__conteo">{countLine(expenseCount, categoryCount)}</span>
      )}
    </div>
  )
}

export interface LatestSectionProps {
  latest: readonly LatestRow[]
  today: string
  onEdit?: (expense: Expense) => void
}

/** The "Latest" block: one row per expense, in the order given. Nothing when there are none. */
export function LatestSection({ latest, today, onEdit }: LatestSectionProps) {
  if (latest.length === 0) return null
  return (
    <div className="gastos__ultimos">
      <span className="gastos__seccion">{EXPENSES_TEXT.latest}</span>
      {latest.map(({ expense, categoryName }) => (
        <ExpenseRow key={expense.id} expense={expense} categoryName={categoryName} today={today} onEdit={onEdit} />
      ))}
    </div>
  )
}

export default function MonthBody({ view, today, onEdit }: MonthBodyProps) {
  const money = useMoney()
  const latest = latestExpenses(view)

  return (
    <>
      <div className="gastos__resumen">
        <MonthTotal total={view.total} expenseCount={latest.length} categoryCount={view.categories.length} />
        {view.categories.length > 0 && (
          <>
            <span className="gastos__seccion">{EXPENSES_TEXT.byCategory}</span>
            <div className="gastos__categorias">
              {view.categories.map((category) => (
                <div key={category.id} className="gastos__categoria">
                  <div className="gastos__categoria-cabecera">
                    <span className="gastos__categoria-nombre">{category.name}</span>
                    <span className="gastos__categoria-subtotal cifra-s">{money.money(category.subtotal)}</span>
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
      <LatestSection latest={latest} today={today} onEdit={onEdit} />
    </>
  )
}
