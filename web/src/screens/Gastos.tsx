/**
 * `Gastos`: the monthly view (`Gastos.dc.html`, `GastosCompu.dc.html`), and editing and
 * deleting an expense (`docs/product/expenses.md`). There is no `GET /expenses/{id}`,
 * so an existing expense is only ever reached from the monthly view's own data,
 * already in the query cache — never refetched by id (plan, "Decisions and
 * assumptions"). Recording a new one is the form's own route (`ExpenseNewRoute`),
 * reached from the "Cargar gasto" action.
 *
 * The month lives in the URL (`?month=`), read only through `parseMonth`, so a save
 * that goes back by history returns to the month that was showing. Its toasts all
 * come from the flash (`showNow`): one toast path.
 *
 * Money a business spends that is not flower; flower bought is stock, never an
 * expense, hence the fixed line at the bottom.
 */

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext, useSearchParams } from 'react-router'
import InAppLink from '../components/InAppLink'
import AnswerButton from '../components/AnswerButton'
import BotonLink from '../components/BotonLink'
import { ApiError, NetworkError } from '../api/client'
import { type Expense, deleteExpense, monthlyView } from '../api/expenses'
import { invalidateResource, keys } from '../api/keys'
import type { Me } from '../api/me'
import { formatDate, formatMonthLong, parseMonth, shiftMonth } from '../format/dates'
import { formatMoney } from '../format/money'
import { isGone } from '../api/refusals'
import { SheetStackProvider } from '../components/useSheetStack'
import GoneNotice from '../components/GoneNotice'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import Icono from '../components/Icono'
import SinConexion from '../components/SinConexion'
import Loading from '../components/Loading'
import { useFlash } from '../flash/useFlash'
import { EXPENSE_CATEGORIES, EXPENSE_NEW } from '../routes'
import ExpenseEditSheet from './expenses/ExpenseEditSheet'
import MonthBody from './expenses/MonthBody'
import { FLOWER_NOTICE, EXPENSES_TEXT } from '../copy/expenses'
import { COMMON_TEXT } from '../copy/common'
import ContentArea from '../components/ContentArea'

export { FLOWER_NOTICE }
export const NO_DISCARD_TITLE = COMMON_TEXT.noKeep
export const YES_DELETE_TITLE = COMMON_TEXT.yesDelete

function deleteQuestion(expense: Expense, categoryName: string, today: string): string {
  return EXPENSES_TEXT.deleteTheExpenseOf(formatMoney(expense.amount), categoryName, formatDate(expense.spent_on, today))
}

function DeleteConfirm({
  expense,
  categoryName,
  today,
  onCancel,
  onDone,
  onGone,
}: {
  expense: Expense
  categoryName: string
  today: string
  onCancel: () => void
  onDone: () => void
  onGone: () => void
}) {
  const queryClient = useQueryClient()
  const [sending, setSending] = useState(false)
  const [offline, setOffline] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm(): Promise<void> {
    setSending(true)
    setOffline(false)
    setError(null)
    try {
      await deleteExpense(expense.id)
      invalidateResource(queryClient, 'expenses')
      onDone()
    } catch (caught) {
      if (caught instanceof NetworkError) {
        setOffline(true)
      } else if (caught instanceof ApiError && isGone(caught.code)) {
        invalidateResource(queryClient, 'expenses')
        onGone()
      } else {
        setError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="capa" role="presentation">
      <div className="capa__contenido panel">
        <span className="panel__titulo">{EXPENSES_TEXT.deleteTheExpense}</span>
        <span className="panel__detalle">{deleteQuestion(expense, categoryName, today)}{EXPENSES_TEXT.thisCannotBeUndone}</span>
        {offline && <SinConexion />}
        {error !== null && (
          <span className="campo__error" role="alert">
            {error}
          </span>
        )}
        <div className="panel__botones">
          <AnswerButton kind="keep" onClick={onCancel}>
            {NO_DISCARD_TITLE}
          </AnswerButton>
          <AnswerButton kind="confirm" disabled={sending} onClick={confirm}>
            {YES_DELETE_TITLE}
          </AnswerButton>
        </div>
      </div>
    </div>
  )
}

export default function Gastos() {
  return (
    <SheetStackProvider>
      <GastosScreen />
    </SheetStackProvider>
  )
}

function GastosScreen() {
  const me = useOutletContext<Me>()
  const flash = useFlash()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const month = parseMonth(searchParams, me.today)
  const [editTarget, setEditTarget] = useState<Expense | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)
  const [goneNotice, setGoneNotice] = useState(false)

  const view = useQuery({ queryKey: keys.expenses(month), queryFn: () => monthlyView(month) })
  // The gone notice clears itself after 2.5 s; a pending timer must not outlive the screen.
  const timers = useRef<number[]>([])
  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((id) => window.clearTimeout(id))
  }, [])

  function moveMonth(delta: number): void {
    setSearchParams({ month: shiftMonth(month, delta) }, { replace: true })
  }

  function flashGone(): void {
    setGoneNotice(true)
    timers.current.push(window.setTimeout(() => setGoneNotice(false), 2500))
  }

  function categoryNameOf(categoryId: number): string {
    const found = view.data?.categories.find((category) => category.id === categoryId)
    return found?.name ?? ''
  }

  return (
    <ContentArea as="main" className="pantalla">
      <div className="cuerpo gastos">
        <div className="gastos__cabecera">
          <span className="encabezado__titulo gastos__titulo">{COMMON_TEXT.expenses}</span>
          <InAppLink to={EXPENSE_NEW} className="gastos__cargar" aria-label={COMMON_TEXT.addExpense}>
            <Icono nombre="agregar" />
            <span className="gastos__cargar-texto">{COMMON_TEXT.addExpense}</span>
          </InAppLink>
          <div className="gastos__mes">
            <button
              type="button"
              className="gastos__mes-boton"
              aria-label={COMMON_TEXT.previousMonth}
              onClick={() => moveMonth(-1)}
            >
              <Icono nombre="atras" />
            </button>
            <span className="gastos__mes-etiqueta">{formatMonthLong(month)}</span>
            <button
              type="button"
              className="gastos__mes-boton"
              aria-label={COMMON_TEXT.nextMonth}
              onClick={() => moveMonth(1)}
            >
              <Icono nombre="chevron" />
            </button>
          </div>
        </div>

        {view.isPending && <Loading />}
        {view.isError && view.error instanceof NetworkError && <SinConexion />}
        {view.isError && !(view.error instanceof NetworkError) && <ErrorGenerico />}

        {view.data !== undefined && (
          <MonthBody view={view.data} today={me.today} onEdit={setEditTarget} />
        )}

        <div className="gastos__pie">
          <span className="pie">{FLOWER_NOTICE}</span>
          <BotonLink to={EXPENSE_CATEGORIES} variant="link">
            {EXPENSES_TEXT.categories}
          </BotonLink>
        </div>
      </div>

      {editTarget !== null && (
        <ExpenseEditSheet
          target={editTarget}
          onClosed={() => setEditTarget(null)}
          onSaved={(saved) => {
            invalidateResource(queryClient, 'expenses')
            flash.showNow(saved)
          }}
          onGone={flashGone}
          onRequestDelete={setDeleteTarget}
        />
      )}
      {deleteTarget !== null && (
        <DeleteConfirm
          expense={deleteTarget}
          categoryName={categoryNameOf(deleteTarget.category_id)}
          today={me.today}
          onCancel={() => setDeleteTarget(null)}
          onDone={() => {
            setDeleteTarget(null)
            flash.showNow(EXPENSES_TEXT.expenseDeleted)
          }}
          onGone={() => {
            setDeleteTarget(null)
            flashGone()
          }}
        />
      )}
      {goneNotice && (
        <div className="aviso-flotante">
          <GoneNotice />
        </div>
      )}
    </ContentArea>
  )
}
