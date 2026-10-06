/**
 * `Gastos`: the monthly view, and recording, editing and deleting an expense
 * (`docs/product/expenses.md`). There is no `GET /expenses/{id}`, so an existing
 * expense is only ever reached from the monthly view's own data, already in the
 * query cache — never refetched by id (plan, "Decisions and assumptions").
 *
 * Money a business spends that is not flower; flower bought is stock, never an
 * expense, hence the fixed line at the bottom.
 */

import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useOutletContext } from 'react-router'
import { ApiError, NetworkError, UNKNOWN_CODE } from '../api/client'
import {
  type Expense,
  type ExpenseCategory,
  type ExpenseInput,
  addCategory,
  deleteExpense,
  editExpense,
  listCategories,
  monthlyView,
  recordExpense,
} from '../api/expenses'
import { invalidateResource, keys } from '../api/keys'
import type { Me } from '../api/me'
import { formatDate, formatMonthLong, shiftMonth } from '../format/dates'
import { formatMoney } from '../format/money'
import { parseMoney } from '../format/parse'
import { isGone, kindOf, resolveOverride, type RefusalCode } from '../api/refusals'
import Aviso, { type SuccessToast } from '../components/Aviso'
import GoneNotice from '../components/GoneNotice'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import SinConexion from '../components/SinConexion'
import Loading from '../components/Loading'

export const FLOWER_NOTICE = 'Las compras de flores no van acá: se cargan en Stock.'
export const CATEGORY_GONE = 'Esa categoría ya no está. Elegí otra.'
export const GENERIC_REFUSAL = 'Revisá los datos e intentá de nuevo.'
export const NO_DISCARD_TITLE = 'No, dejala'
export const YES_DELETE_TITLE = 'Sí, borrala'

// `expense_category.not_found` is the one code the expense form handles on its
// own field instead of the generic gone notice (PM round 3): the expense itself
// still has somewhere to go, so nothing is discarded.
const EXPENSE_FORM_OVERRIDES: Partial<Record<RefusalCode, 'category-gone'>> = {
  'expense_category.not_found': 'category-gone',
}

function isRefusal(caught: unknown): caught is ApiError {
  return caught instanceof ApiError && caught.code !== UNKNOWN_CODE && kindOf(caught.code) === 'refusal'
}

type FormTarget = 'nuevo' | Expense

function amountLabel(amount: number): string {
  return formatMoney(amount)
}

function deleteQuestion(expense: Expense, categoryName: string, today: string): string {
  return `¿Borrás el gasto de ${amountLabel(expense.amount)} en ${categoryName} del ${formatDate(expense.spent_on, today)}?`
}

interface FormState {
  spent_on: string
  category_id: string
  amount: string
  detail: string
}

function initialForm(target: FormTarget, today: string): FormState {
  if (target === 'nuevo') {
    return { spent_on: today, category_id: '', amount: '', detail: '' }
  }
  return {
    spent_on: target.spent_on,
    category_id: String(target.category_id),
    amount: String(target.amount),
    detail: target.detail,
  }
}

function ExpenseForm({
  target,
  today,
  categories,
  onDone,
  onGone,
  onRequestDelete,
}: {
  target: FormTarget
  today: string
  categories: ExpenseCategory[]
  onDone: (toast: SuccessToast) => void
  onGone: () => void
  onRequestDelete: (expense: Expense) => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(() => initialForm(target, today))
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [sending, setSending] = useState(false)
  const [extraCategories, setExtraCategories] = useState<ExpenseCategory[]>([])
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryError, setNewCategoryError] = useState<string | null>(null)
  const [newCategorySending, setNewCategorySending] = useState(false)

  const allCategories = [
    ...categories,
    ...extraCategories.filter((extra) => !categories.some((category) => category.id === extra.id)),
  ]

  const detailTrimmed = form.detail.trim()
  const canSubmit = form.category_id !== '' && detailTrimmed !== '' && !sending

  async function onCreateCategory(): Promise<void> {
    setNewCategoryError(null)
    setOffline(false)
    setNewCategorySending(true)
    try {
      const created = await addCategory(newCategoryName)
      invalidateResource(queryClient, 'expenseCategories')
      setExtraCategories((previous) => [...previous, created])
      setForm((previous) => ({ ...previous, category_id: String(created.id) }))
      setCategoryError(null)
      setCreatingCategory(false)
      setNewCategoryName('')
    } catch (caught) {
      if (caught instanceof NetworkError) setOffline(true)
      else if (isRefusal(caught)) setNewCategoryError(GENERIC_REFUSAL)
      else setFormError(ERROR_GENERICO_MENSAJE)
    } finally {
      setNewCategorySending(false)
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setFormError(null)
    setCategoryError(null)
    setOffline(false)
    const parsedAmount = parseMoney(form.amount)
    if (!parsedAmount.ok) {
      setFormError(GENERIC_REFUSAL)
      return
    }
    const body: ExpenseInput = {
      spent_on: form.spent_on,
      category_id: Number(form.category_id),
      amount: parsedAmount.value,
      detail: detailTrimmed,
    }
    setSending(true)
    try {
      if (target === 'nuevo') {
        await recordExpense(body)
      } else {
        await editExpense(target.id, body)
      }
      invalidateResource(queryClient, 'expenses')
      onDone('Gasto guardado')
    } catch (caught) {
      if (caught instanceof NetworkError) {
        setOffline(true)
      } else if (caught instanceof ApiError && resolveOverride(EXPENSE_FORM_OVERRIDES, caught.code) === 'category-gone') {
        invalidateResource(queryClient, 'expenseCategories')
        setForm((previous) => ({ ...previous, category_id: '' }))
        setCategoryError(CATEGORY_GONE)
      } else if (caught instanceof ApiError && isGone(caught.code)) {
        invalidateResource(queryClient, 'expenses')
        onGone()
      } else if (isRefusal(caught)) {
        setFormError(GENERIC_REFUSAL)
      } else {
        setFormError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="capa" role="presentation">
      <div className="capa__contenido">
        <span className="panel__titulo">{target === 'nuevo' ? 'Nuevo gasto' : 'Editar gasto'}</span>
        <form className="formulario" onSubmit={onSubmit}>
          <label className="campo">
            <span className="campo__rotulo">Fecha</span>
            <input
              className="campo__input"
              type="date"
              value={form.spent_on}
              max={today}
              onChange={(event) => setForm((previous) => ({ ...previous, spent_on: event.target.value }))}
              required
            />
          </label>
          <label className="campo">
            <span className="campo__rotulo">Categoría</span>
            <select
              className="campo__input"
              value={form.category_id}
              onChange={(event) => {
                setCategoryError(null)
                setForm((previous) => ({ ...previous, category_id: event.target.value }))
              }}
              required
            >
              <option value="">Elegí una categoría</option>
              {allCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          {categoryError !== null && (
            <span className="campo__error" role="alert">
              {categoryError}
            </span>
          )}
          {creatingCategory ? (
            <div className="campo">
              <label className="campo">
                <span className="campo__rotulo">Nombre de la categoría nueva</span>
                <input
                  className="campo__input"
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                />
              </label>
              {newCategoryError !== null && (
                <span className="campo__error" role="alert">
                  {newCategoryError}
                </span>
              )}
              <button
                type="button"
                className="boton"
                disabled={newCategorySending || newCategoryName.trim() === ''}
                onClick={onCreateCategory}
              >
                Crear categoría
              </button>
            </div>
          ) : (
            <button type="button" className="boton--enlace" onClick={() => setCreatingCategory(true)}>
              Crear una categoría nueva
            </button>
          )}
          <label className="campo">
            <span className="campo__rotulo">Monto</span>
            <input
              className="campo__input"
              inputMode="numeric"
              value={form.amount}
              onChange={(event) => setForm((previous) => ({ ...previous, amount: event.target.value }))}
              required
            />
          </label>
          <label className="campo">
            <span className="campo__rotulo">Detalle</span>
            <input
              className="campo__input"
              value={form.detail}
              maxLength={200}
              onChange={(event) => setForm((previous) => ({ ...previous, detail: event.target.value }))}
              required
            />
          </label>
          {formError !== null && (
            <span className="campo__error" role="alert">
              {formError}
            </span>
          )}
          {offline && <SinConexion />}
          <button className="boton" type="submit" disabled={!canSubmit}>
            Guardar
          </button>
          {target !== 'nuevo' && (
            <button
              type="button"
              className="boton--enlace"
              onClick={() => onRequestDelete(target)}
            >
              Borrar gasto
            </button>
          )}
        </form>
      </div>
    </div>
  )
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
          <button type="button" className="boton boton--suave" onClick={onCancel}>
            {NO_DISCARD_TITLE}
          </button>
          <button type="button" className="boton boton--destructivo" disabled={sending} onClick={confirm}>
            {YES_DELETE_TITLE}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Gastos() {
  const me = useOutletContext<Me>()
  const [month, setMonth] = useState(() => me.today.slice(0, 7))
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)
  const [toast, setToast] = useState<SuccessToast | null>(null)
  const [goneNotice, setGoneNotice] = useState(false)

  const view = useQuery({ queryKey: keys.expenses(month), queryFn: () => monthlyView(month) })
  const categories = useQuery({ queryKey: keys.expenseCategories(), queryFn: listCategories })

  // The notices clear themselves after 2.5 s; a pending timer must not outlive the screen.
  const timers = useRef<number[]>([])
  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((id) => window.clearTimeout(id))
  }, [])

  function flash(message: SuccessToast): void {
    setToast(message)
    timers.current.push(window.setTimeout(() => setToast(null), 2500))
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
    <main className="pantalla">
      <div className="cuerpo">
        <div>
          <span className="encabezado__titulo">Gastos</span>
        </div>
        <div className="gastos__mes">
          <button
            type="button"
            className="gastos__mes-boton"
            aria-label="Mes anterior"
            onClick={() => setMonth((current) => shiftMonth(current, -1))}
          >
            ‹
          </button>
          <span className="gastos__mes-etiqueta">{formatMonthLong(month)}</span>
          <button
            type="button"
            className="gastos__mes-boton"
            aria-label="Mes siguiente"
            onClick={() => setMonth((current) => shiftMonth(current, 1))}
          >
            ›
          </button>
        </div>

        {view.isPending && <Loading />}
        {view.isError && view.error instanceof NetworkError && <SinConexion />}
        {view.isError && !(view.error instanceof NetworkError) && <ErrorGenerico />}

        {view.data !== undefined && (
          <>
            <div>
              <span className="rotulo">Gastaste en el mes</span>
              <span className="cifra-xl">{formatMoney(view.data.total)}</span>
            </div>
            {view.data.categories.map((category) => (
              <div key={category.id} className="gastos__categoria">
                <div className="gastos__categoria-cabecera">
                  <span className="gastos__categoria-nombre">{category.name}</span>
                  <span className="gastos__categoria-subtotal">{formatMoney(category.subtotal)}</span>
                </div>
                {category.expenses.map((expense) => (
                  <button
                    key={expense.id}
                    type="button"
                    className="fila-gasto"
                    onClick={() => setFormTarget(expense)}
                  >
                    <span className="fila-gasto__fecha">{formatDate(expense.spent_on, me.today)}</span>
                    <span className="fila-gasto__texto">{expense.detail}</span>
                    <span className="fila-gasto__monto">{formatMoney(expense.amount)}</span>
                  </button>
                ))}
              </div>
            ))}
          </>
        )}

        <span className="pie">{FLOWER_NOTICE}</span>
        <Link to="/gastos/categorias" className="boton--enlace">
          Categorías
        </Link>
        <button type="button" className="boton" onClick={() => setFormTarget('nuevo')}>
          Nuevo gasto
        </button>
      </div>

      {formTarget !== null && categories.data !== undefined && (
        <ExpenseForm
          target={formTarget}
          today={me.today}
          categories={categories.data}
          onDone={(message) => {
            setFormTarget(null)
            flash(message)
          }}
          onGone={() => {
            setFormTarget(null)
            flashGone()
          }}
          onRequestDelete={(expense) => {
            setFormTarget(null)
            setDeleteTarget(expense)
          }}
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
            setFormTarget(null)
            flash('Gasto eliminado')
          }}
          onGone={() => {
            setDeleteTarget(null)
            setFormTarget(null)
            flashGone()
          }}
        />
      )}
      {toast !== null && <Aviso texto={toast} />}
      {goneNotice && (
        <div className="aviso-flotante">
          <GoneNotice />
        </div>
      )}
    </main>
  )
}
