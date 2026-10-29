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
import ConfirmDialog from '../components/ConfirmDialog'
import Sheet from '../components/Sheet'
import GoneNotice from '../components/GoneNotice'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import Icono from '../components/Icono'
import SinConexion from '../components/SinConexion'
import Loading from '../components/Loading'
import { useFlash } from '../flash/useFlash'
import { EXPENSE_CATEGORIES, EXPENSE_NEW } from '../routes'
import ExpenseForm from './expenses/ExpenseForm'
import MonthBody from './expenses/MonthBody'
import { useViewport } from '../shell/useViewport'
import { FLOWER_NOTICE, EXPENSES_TEXT } from '../copy/expenses'
import { COMMON_TEXT } from '../copy/common'

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
  const me = useOutletContext<Me>()
  const flash = useFlash()
  const computer = useViewport() === 'computer'
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const month = parseMonth(searchParams, me.today)
  const [editTarget, setEditTarget] = useState<Expense | null>(null)
  const [editDirty, setEditDirty] = useState(false)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)
  const [goneNotice, setGoneNotice] = useState(false)

  const view = useQuery({ queryKey: keys.expenses(month), queryFn: () => monthlyView(month) })
  // On a computer it is the last child of `.capa__contenido`, as it always was; on a phone it sits
  // beside the sheet's body.
  const discardDialog = confirmingDiscard && (
    <ConfirmDialog
      title={COMMON_TEXT.discardTheChanges}
      detail={EXPENSES_TEXT.whatYouChangedIsLost}
      confirmText={EXPENSES_TEXT.yesDiscardThem}
      cancelText={COMMON_TEXT.noKeepEditing}
      onConfirm={closeEdit}
      onCancel={() => setConfirmingDiscard(false)}
    />
  )

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

  function closeEdit(): void {
    setEditTarget(null)
    setEditDirty(false)
    setConfirmingDiscard(false)
  }

  function categoryNameOf(categoryId: number): string {
    const found = view.data?.categories.find((category) => category.id === categoryId)
    return found?.name ?? ''
  }

  return (
    <main className="pantalla">
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
        // An in-page sheet (ADR-0062): Expenses itself is behind it, so no `BehindPane`. On a
        // computer it is the `.capa` it always was, a `div` since the screen is already the `main`.
        <Sheet
          computer={computer}
          computerClass="capa"
          computerBodyClass="capa__contenido"
          computerDialog={false}
          frameTag="div"
          label={EXPENSES_TEXT.editExpense}
          touched={editDirty}
          onClose={() => (editDirty ? setConfirmingDiscard(true) : closeEdit())}
          computerFrameRole="presentation"
          aside={!computer && discardDialog}
        >
          <ExpenseForm
            target={editTarget}
            onDirtyChange={setEditDirty}
            onCancel={() => (editDirty ? setConfirmingDiscard(true) : closeEdit())}
            onDone={(saved) => {
              invalidateResource(queryClient, 'expenses')
              closeEdit()
              flash.showNow(saved)
            }}
            onGone={() => {
              closeEdit()
              flashGone()
            }}
            onRequestDelete={(expense) => {
              closeEdit()
              setDeleteTarget(expense)
            }}
          />
          {computer && discardDialog}
        </Sheet>
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
    </main>
  )
}
