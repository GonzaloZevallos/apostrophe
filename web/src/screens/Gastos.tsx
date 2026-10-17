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
import GoneNotice from '../components/GoneNotice'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import Icono from '../components/Icono'
import SinConexion from '../components/SinConexion'
import Loading from '../components/Loading'
import { useFlash } from '../flash/useFlash'
import { EXPENSE_CATEGORIES, EXPENSE_NEW } from '../routes'
import ExpenseForm from './expenses/ExpenseForm'
import { FLOWER_NOTICE } from '../copy/expenses'

export { FLOWER_NOTICE }
export const NO_DISCARD_TITLE = 'No, dejala'
export const YES_DELETE_TITLE = 'Sí, borrala'

function deleteQuestion(expense: Expense, categoryName: string, today: string): string {
  return `¿Borrás el gasto de ${formatMoney(expense.amount)} en ${categoryName} del ${formatDate(expense.spent_on, today)}?`
}

function countLine(expenses: number, categories: number): string {
  const spent = expenses === 1 ? '1 gasto' : `${expenses} gastos`
  const inCategories = categories === 1 ? '1 categoría' : `${categories} categorías`
  return `${spent} en ${inCategories}`
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
        <span className="panel__titulo">¿Borrás el gasto?</span>
        <span className="panel__detalle">{deleteQuestion(expense, categoryName, today)} Esto no se puede deshacer.</span>
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
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const month = parseMonth(searchParams, me.today)
  const [editTarget, setEditTarget] = useState<Expense | null>(null)
  const [editDirty, setEditDirty] = useState(false)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
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

  function closeEdit(): void {
    setEditTarget(null)
    setEditDirty(false)
    setConfirmingDiscard(false)
  }

  function categoryNameOf(categoryId: number): string {
    const found = view.data?.categories.find((category) => category.id === categoryId)
    return found?.name ?? ''
  }

  const latest =
    view.data === undefined
      ? []
      : view.data.categories
          .flatMap((category) => category.expenses.map((expense) => ({ expense, categoryName: category.name })))
          .sort((a, b) => b.expense.spent_on.localeCompare(a.expense.spent_on) || b.expense.id - a.expense.id)

  return (
    <main className="pantalla">
      <div className="cuerpo gastos">
        <div className="gastos__cabecera">
          <span className="encabezado__titulo gastos__titulo">Gastos</span>
          <InAppLink to={EXPENSE_NEW} className="gastos__cargar" aria-label="Cargar gasto">
            <Icono nombre="agregar" />
            <span className="gastos__cargar-texto">Cargar gasto</span>
          </InAppLink>
          <div className="gastos__mes">
            <button
              type="button"
              className="gastos__mes-boton"
              aria-label="Mes anterior"
              onClick={() => moveMonth(-1)}
            >
              <Icono nombre="atras" />
            </button>
            <span className="gastos__mes-etiqueta">{formatMonthLong(month)}</span>
            <button
              type="button"
              className="gastos__mes-boton"
              aria-label="Mes siguiente"
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
          <>
            <div className="gastos__resumen">
              <div className="gastos__total">
                <span className="rotulo">Gastaste en el mes</span>
                <span className="cifra-xl">{formatMoney(view.data.total)}</span>
                {latest.length > 0 && (
                  <span className="gastos__conteo">{countLine(latest.length, view.data.categories.length)}</span>
                )}
              </div>
              {view.data.categories.length > 0 && (
                <>
                  <span className="gastos__seccion">Por categoría</span>
                  <div className="gastos__categorias">
                    {view.data.categories.map((category) => (
                      <div key={category.id} className="gastos__categoria">
                        <div className="gastos__categoria-cabecera">
                          <span className="gastos__categoria-nombre">{category.name}</span>
                          <span className="gastos__categoria-subtotal">{formatMoney(category.subtotal)}</span>
                        </div>
                        <span className="gastos__barra" aria-hidden="true">
                          <span
                            className="gastos__barra-relleno"
                            style={{ width: `${Math.round((category.subtotal / view.data.total) * 100)}%` }}
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
                <span className="gastos__seccion">Últimos</span>
                {latest.map(({ expense, categoryName }) => (
                  <button
                    key={expense.id}
                    type="button"
                    className="fila-gasto"
                    onClick={() => setEditTarget(expense)}
                  >
                    <span className="fila-gasto__fecha">{formatDate(expense.spent_on, me.today)}</span>
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
        )}

        <div className="gastos__pie">
          <span className="pie">{FLOWER_NOTICE}</span>
          <BotonLink to={EXPENSE_CATEGORIES} variant="link">
            Categorías
          </BotonLink>
        </div>
      </div>

      {editTarget !== null && (
        <div className="capa" role="presentation">
          <div className="capa__contenido">
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
            {confirmingDiscard && (
              <ConfirmDialog
                title="¿Descartás los cambios?"
                detail="Se pierde lo que cambiaste: el gasto sigue como estaba."
                confirmText="Sí, descartalos"
                cancelText="No, seguí editando"
                onConfirm={closeEdit}
                onCancel={() => setConfirmingDiscard(false)}
              />
            )}
          </div>
        </div>
      )}
      {deleteTarget !== null && (
        <DeleteConfirm
          expense={deleteTarget}
          categoryName={categoryNameOf(deleteTarget.category_id)}
          today={me.today}
          onCancel={() => setDeleteTarget(null)}
          onDone={() => {
            setDeleteTarget(null)
            flash.showNow('Gasto eliminado')
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
