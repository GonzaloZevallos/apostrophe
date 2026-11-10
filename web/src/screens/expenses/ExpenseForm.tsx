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

import { type FormEvent, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLoading } from '../../components/useLoading'
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
import { SheetActions } from '../../components/Sheet'
import Selector from '../../components/Selector'
import SinConexion from '../../components/SinConexion'
import { useViewport } from '../../shell/useViewport'
import { parseMoney } from '../../format/parse'
import { EXPENSES_TEXT } from '../../copy/expenses'
import { COMMON_TEXT } from '../../copy/common'
import { GENERIC_REFUSAL_MESSAGE } from '../../copy/settings'
import { TOO_MANY_DECIMALS_CODE, tooManyDecimalsMessage } from '../../api/amountRefusal'

export const CATEGORY_GONE = EXPENSES_TEXT.categoryGone
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
  const phone = useViewport() === 'phone'
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const categoryErrorId = useId()
  const categoriesQuery = useQuery({ queryKey: keys.expenseCategories(), queryFn: listCategories })
  const [initial] = useState<FormState>(() => initialForm(target, me.today))
  const [form, setForm] = useState<FormState>(initial)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)
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

  // The form draws only its header until the categories answer.
  useLoading(categoriesQuery.isPending)
  const categories = categoriesQuery.data ?? []
  // The query is the single source: an inline-created category stops being offered as an extra
  // the moment the query holds it.
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
    setAmountError(null)
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
      onDone(EXPENSES_TEXT.expenseSaved)
    } catch (caught) {
      if (caught instanceof NetworkError) {
        setOffline(true)
      } else if (caught instanceof ApiError && resolveOverride(EXPENSE_FORM_OVERRIDES, caught.code) === 'category-gone') {
        invalidateResource(queryClient, 'expenseCategories')
        setExtraCategories((previous) => previous.filter((extra) => extra.id !== body.category_id))
        setForm((previous) => ({ ...previous, category_id: '' }))
        setCategoryError(CATEGORY_GONE)
      } else if (caught instanceof ApiError && isGone(caught.code)) {
        invalidateResource(queryClient, 'expenses')
        onGone?.()
      } else if (caught instanceof ApiError && caught.code === TOO_MANY_DECIMALS_CODE) {
        setAmountError(tooManyDecimalsMessage())
      } else if (isRefusal(caught)) {
        setFormError(GENERIC_REFUSAL)
      } else {
        setFormError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSending(false)
    }
  }

  // The header, with "Cerrar", shows whatever the categories do, so the seller can
  // always leave.
  const header = (
    <div className="gasto-form__cabecera">
      <span className="gasto-form__titulo">{target === 'nuevo' ? COMMON_TEXT.addExpense : EXPENSES_TEXT.editExpense}</span>
      <span className="gasto-form__cerrar">
        <Boton variant="icon" action="close" ariaLabel={COMMON_TEXT.close} onClick={onCancel} />
      </span>
    </div>
  )

  // On a phone the destructive action sits above the main action, in the pinned actions; on a
  // computer the form keeps the order it had (ADR-0062).
  const deleteButton = target !== 'nuevo' && onRequestDelete !== undefined && (
    <Boton variant="icon" action="delete" ariaLabel={EXPENSES_TEXT.deleteExpense} onClick={() => onRequestDelete(target)} />
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
          <span className="campo__rotulo">{COMMON_TEXT.date}</span>
          <input
            className="campo__input"
            type="date"
            autoComplete="off"
            value={form.spent_on}
            max={me.today}
            onChange={(event) => setForm((previous) => ({ ...previous, spent_on: event.target.value }))}
            required
          />
        </label>
        <div className="campo">
          <Selector
            required
            label={COMMON_TEXT.category}
            placeholder={EXPENSES_TEXT.pickACategory}
            options={allCategories.map((category) => ({ value: String(category.id), label: category.name }))}
            value={form.category_id === '' ? null : form.category_id}
            onChange={(next) => {
              setCategoryError(null)
              setForm((previous) => ({ ...previous, category_id: next ?? '' }))
            }}
            loading={categoriesQuery.isPending || categoriesQuery.isError}
            emptySetMessage={t('emptyStates:selectorNoCategories')}
            describedBy={categoryError === null ? undefined : categoryErrorId}
          />
          {categoryError !== null && (
            <span className="campo__error" role="alert" id={categoryErrorId}>
              {categoryError}
            </span>
          )}
        </div>
        {creatingCategory ? (
          <div className="campo">
            <label className="campo">
              <span className="campo__rotulo">{EXPENSES_TEXT.newCategoryName}</span>
              <input
                className="campo__input"
                autoComplete="off"
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
              {EXPENSES_TEXT.createCategory}
            </Boton>
          </div>
        ) : (
          <Boton variant="link" onClick={() => setCreatingCategory(true)}>
            {EXPENSES_TEXT.createANewCategory}
          </Boton>
        )}
        <label className="campo">
          <span className="campo__rotulo">{COMMON_TEXT.amount}</span>
          <input
            className="campo__input campo__input--monto"
            inputMode="numeric"
            autoComplete="off"
            value={form.amount}
            onChange={(event) => setForm((previous) => ({ ...previous, amount: event.target.value }))}
            required
          />
          {amountError !== null && (
            <span className="campo__error" role="alert">
              {amountError}
            </span>
          )}
        </label>
        <label className="campo">
          <span className="campo__rotulo">{EXPENSES_TEXT.details}</span>
          <input
            className="campo__input"
            value={form.detail}
            autoComplete="off"
            maxLength={200}
            onChange={(event) => setForm((previous) => ({ ...previous, detail: event.target.value }))}
            required
          />
        </label>
        <SheetActions>
          {formError !== null && (
            <span className="campo__error" role="alert">
              {formError}
            </span>
          )}
          {offline && <SinConexion />}
          {phone && deleteButton}
          <Boton textOnly="submit" type="submit" disabled={!canSubmit}>
            {EXPENSES_TEXT.saveTheExpense}
          </Boton>
          {!phone && deleteButton}
        </SheetActions>
      </form>
    </div>
  )
}
