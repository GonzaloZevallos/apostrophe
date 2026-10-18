/**
 * `ExpenseForm`: the form to record or edit an expense, with its inline category
 * creation (`docs/product/expenses.md`; `GastoNuevo.dc.html`). It knows nothing about
 * where it is shown: its host supplies every exit (`onDone`, `onCancel`) and learns
 * whether something was typed through `onDirtyChange`, so the host alone decides how
 * leaving works. Hence no router hook is imported here (plan, invariants).
 *
 * The form saves, but never refreshes the month or toasts: those are the host's, since
 * what comes next (go back, or close an overlay) is the host's too.
 *
 * `onRequestDelete` and `onGone` are only given by the host that edits an existing
 * expense (Gastos): a new expense can neither be deleted nor be already gone.
 */

import { type FormEvent, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router'
import { ApiError, NetworkError, UNKNOWN_CODE } from '../../api/client'
import {
  type Expense,
  type ExpenseCategory,
  type ExpenseInput,
  addCategory,
  editExpense,
  listCategories,
  recordExpense,
} from '../../api/expenses'
import { invalidateResource, keys } from '../../api/keys'
import type { Me } from '../../api/me'
import { isGone, kindOf, resolveOverride, type RefusalCode } from '../../api/refusals'
import type { SuccessToast } from '../../components/AvisoExito'
import Boton from '../../components/Boton'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import SinConexion from '../../components/SinConexion'
import { parseMoney } from '../../format/parse'
import { CLOSE, GENERIC_REFUSAL_MESSAGE } from '../../copy/common'
import * as copy from '../../copy/expenses'
import { CATEGORY_GONE } from '../../copy/expenses'

export { CATEGORY_GONE }
export const GENERIC_REFUSAL = GENERIC_REFUSAL_MESSAGE

// `expense_category.not_found` is the one code the expense form handles on its
// own field instead of the generic gone notice (PM round 3): the expense itself
// still has somewhere to go, so nothing is discarded.
const EXPENSE_FORM_OVERRIDES: Partial<Record<RefusalCode, 'category-gone'>> = {
  'expense_category.not_found': 'category-gone',
}

function isRefusal(caught: unknown): caught is ApiError {
  return caught instanceof ApiError && caught.code !== UNKNOWN_CODE && kindOf(caught.code) === 'refusal'
}

export type FormTarget = 'nuevo' | Expense

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

function sameForm(a: FormState, b: FormState): boolean {
  return (
    a.spent_on === b.spent_on &&
    a.category_id === b.category_id &&
    a.amount === b.amount &&
    a.detail === b.detail
  )
}

export interface ExpenseFormProps {
  target: FormTarget
  onDone: (saved: SuccessToast) => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
  onRequestDelete?: (expense: Expense) => void
  onGone?: () => void
}

export default function ExpenseForm({
  target,
  onDone,
  onCancel,
  onDirtyChange,
  onRequestDelete,
  onGone,
}: ExpenseFormProps) {
  const me = useOutletContext<Me>()
  const queryClient = useQueryClient()
  const categoriesQuery = useQuery({ queryKey: keys.expenseCategories(), queryFn: listCategories })
  const [initial] = useState<FormState>(() => initialForm(target, me.today))
  const [form, setForm] = useState<FormState>(initial)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [sending, setSending] = useState(false)
  const [extraCategories, setExtraCategories] = useState<ExpenseCategory[]>([])
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryError, setNewCategoryError] = useState<string | null>(null)
  const [newCategorySending, setNewCategorySending] = useState(false)

  const dirty = !sameForm(form, initial)
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  const categories = categoriesQuery.data ?? []
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
      onDone(copy.EXPENSE_SAVED)
    } catch (caught) {
      if (caught instanceof NetworkError) {
        setOffline(true)
      } else if (caught instanceof ApiError && resolveOverride(EXPENSE_FORM_OVERRIDES, caught.code) === 'category-gone') {
        invalidateResource(queryClient, 'expenseCategories')
        setForm((previous) => ({ ...previous, category_id: '' }))
        setCategoryError(CATEGORY_GONE)
      } else if (caught instanceof ApiError && isGone(caught.code)) {
        invalidateResource(queryClient, 'expenses')
        onGone?.()
      } else if (isRefusal(caught)) {
        setFormError(GENERIC_REFUSAL)
      } else {
        setFormError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSending(false)
    }
  }

  // The header, with "Close", shows whatever the categories do, so the seller can
  // always leave.
  const header = (
    <div className="gasto-form__cabecera">
      <span className="gasto-form__titulo">{target === 'nuevo' ? copy.FORM_TITLE_NEW : copy.FORM_TITLE_EDIT}</span>
      <span className="gasto-form__cerrar">
        <Boton variant="icon" action="close" ariaLabel={CLOSE} onClick={onCancel} />
      </span>
    </div>
  )

  if (categoriesQuery.isError) {
    return (
      <div className="gasto-form">
        {header}
        {categoriesQuery.error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />}
      </div>
    )
  }
  if (categoriesQuery.data === undefined) return <div className="gasto-form">{header}</div>

  return (
    <div className="gasto-form">
      {header}
      <form className="formulario" onSubmit={onSubmit}>
        <label className="campo">
          <span className="campo__rotulo">{copy.FIELD_DATE}</span>
          <input
            className="campo__input"
            type="date"
            value={form.spent_on}
            max={me.today}
            onChange={(event) => setForm((previous) => ({ ...previous, spent_on: event.target.value }))}
            required
          />
        </label>
        <label className="campo">
          <span className="campo__rotulo">{copy.FIELD_CATEGORY}</span>
          <select
            className="campo__input"
            value={form.category_id}
            onChange={(event) => {
              setCategoryError(null)
              setForm((previous) => ({ ...previous, category_id: event.target.value }))
            }}
            required
          >
            <option value="">{copy.PICK_CATEGORY}</option>
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
              <span className="campo__rotulo">{copy.NEW_CATEGORY_NAME}</span>
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
            <Boton
              icon="agregar"
              disabled={newCategorySending || newCategoryName.trim() === ''}
              onClick={onCreateCategory}
            >
              {copy.CREATE_CATEGORY}
            </Boton>
          </div>
        ) : (
          <Boton variant="link" onClick={() => setCreatingCategory(true)}>
            {copy.CREATE_NEW_CATEGORY}
          </Boton>
        )}
        <label className="campo">
          <span className="campo__rotulo">{copy.FIELD_AMOUNT}</span>
          <input
            className="campo__input campo__input--monto"
            inputMode="numeric"
            value={form.amount}
            onChange={(event) => setForm((previous) => ({ ...previous, amount: event.target.value }))}
            required
          />
        </label>
        <label className="campo">
          <span className="campo__rotulo">{copy.FIELD_DETAIL}</span>
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
        <Boton textOnly="submit" type="submit" disabled={!canSubmit}>
          {copy.SAVE_EXPENSE}
        </Boton>
        {target !== 'nuevo' && onRequestDelete !== undefined && (
          <Boton
            variant="icon"
            action="delete"
            ariaLabel={copy.DELETE_EXPENSE}
            onClick={() => onRequestDelete(target)}
          />
        )}
      </form>
    </div>
  )
}
