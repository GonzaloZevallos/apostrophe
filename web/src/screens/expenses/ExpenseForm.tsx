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

import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react'
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
import DateRow from '../../components/DateRow'
import FieldRefusal from '../../components/FieldRefusal'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import MoneyInput from '../../components/MoneyInput'
import { SheetActions } from '../../components/Sheet'
import Selector from '../../components/Selector'
import SinConexion from '../../components/SinConexion'
import { useViewport } from '../../shell/useViewport'
import { amountReason, formatMoneyInput, parseMoneyInput } from '../../format/parse'
import type { MoneyFormat } from '../../format/money'
import { useMoney } from '../../format/moneyContext'
import { EXPENSES_TEXT } from '../../copy/expenses'
import { COMMON_TEXT } from '../../copy/common'
import { GENERIC_REFUSAL_MESSAGE } from '../../copy/settings'
import { AMOUNT_REFUSAL_CODE, tooManyDecimalsMessage } from '../../api/amountRefusal'
import {
  howYouPaidView,
  paymentMethodName,
  paymentMethodOf,
  paymentMethodValue,
  usePaymentMethodOptions,
} from '../../sales/paymentMethods'

export const CATEGORY_GONE = EXPENSES_TEXT.categoryGone
export const GENERIC_REFUSAL = GENERIC_REFUSAL_MESSAGE

// These codes are handled on their own field instead of the generic gone notice (PM round 3): the
// expense itself still has somewhere to go, so nothing is discarded. A refused Payment method is
// handled here too, and always before `isGone`, because the contract lists both as `gone`.
const EXPENSE_FORM_OVERRIDES: Partial<Record<RefusalCode, 'category-gone' | 'method-gone'>> = {
  'expense_category.not_found': 'category-gone',
  'payment_method.unavailable': 'method-gone',
  'payment_method.not_found': 'method-gone',
}

// The Save label draws the amount inside its own nowrap span: the text is split around this mark.
const AMOUNT_MARK = '\u2063'

function isRefusal(caught: unknown): caught is ApiError {
  return caught instanceof ApiError && caught.code !== UNKNOWN_CODE && kindOf(caught.code) === 'refusal'
}

export type FormTarget = 'nuevo' | Expense

interface FormState {
  spent_on: string
  category_id: string
  amount: string
  detail: string
  /** The stored method's id, never resolved through the offered list. `null` is no method. */
  payment_method_id: number | null
}

function initialForm(target: FormTarget, today: string, format: MoneyFormat): FormState {
  if (target === 'nuevo') {
    return { spent_on: today, category_id: '', amount: '', detail: '', payment_method_id: null }
  }
  return {
    spent_on: target.spent_on,
    category_id: String(target.category_id),
    amount: formatMoneyInput(target.amount, format),
    detail: target.detail,
    payment_method_id: target.payment_method?.id ?? null,
  }
}

function sameForm(a: FormState, b: FormState): boolean {
  return (
    a.spent_on === b.spent_on &&
    a.category_id === b.category_id &&
    a.amount === b.amount &&
    a.detail === b.detail &&
    a.payment_method_id === b.payment_method_id
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
  const money = useMoney()
  const phone = useViewport() === 'phone'
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const categoryErrorId = useId()
  const methodErrorId = useId()
  const amountReasonId = useId()
  const categoriesQuery = useQuery({ queryKey: keys.expenseCategories(), queryFn: listCategories })
  const [initial] = useState<FormState>(() => initialForm(target, me.today, money.format))
  const [form, setForm] = useState<FormState>(initial)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  // The amount's sentence is never state: it is worked out at render from the text, whether the field
  // was left, and a server refusal tied to the exact text it refused.
  const [blurred, setBlurred] = useState(false)
  const [refusal, setRefusal] = useState<{ text: string; message: string } | null>(null)
  const [methodGone, setMethodGone] = useState<{ id: number; name: string } | null>(null)
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

  const methodOptions = usePaymentMethodOptions()
  const storedMethod = target === 'nuevo' || target.payment_method === null ? null : target.payment_method
  const methodView = howYouPaidView({
    storedMethod: storedMethod === null ? null : { id: storedMethod.id, name: storedMethod.name },
    value: paymentMethodValue(form.payment_method_id),
    offeredIds: methodOptions.offeredIds,
    methodOptions: methodOptions.selector.options,
    loading: methodOptions.selector.loading,
    failure: methodOptions.failure,
    methodGone,
  })

  // The Selector calls `onOpenChange` again whenever its identity changes, so this one is stable and
  // reads the hook's latest failure and `reload` through a ref: a tap on a failed field reads once.
  const methodListRef = useRef({ failed: methodOptions.failure !== null, reload: methodOptions.reload })
  useEffect(() => {
    methodListRef.current = { failed: methodOptions.failure !== null, reload: methodOptions.reload }
  })
  const onMethodListOpenChange = useCallback((open: boolean) => {
    if (open && methodListRef.current.failed) methodListRef.current.reload()
  }, [])

  const detailTrimmed = form.detail.trim()
  const reason = amountReason(form.amount, money.format)
  const amountSentence: { rule: 'tooManyDecimals' | 'notAboveZero' | 'refusal'; text: string } | null =
    reason === 'tooManyDecimals'
      ? { rule: 'tooManyDecimals', text: tooManyDecimalsMessage(money.format) }
      : reason === 'notAboveZero' && blurred
        ? { rule: 'notAboveZero', text: t('expenses:form.amountAboveZero', { amount: money.money(0) }) }
        : refusal !== null && refusal.text === form.amount
          ? { rule: 'refusal', text: refusal.message }
          : null
  const amountRule = amountSentence?.rule ?? null
  const amountReasonRef = useRef<HTMLSpanElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  // A new sentence is brought into view: the keyboard or the pinned Save may cover it.
  useEffect(() => {
    if (amountRule !== null) amountReasonRef.current?.scrollIntoView({ block: 'nearest' })
  }, [amountRule])
  // One boolean for the button, its tap and the submit: nothing is sent while the form cannot save.
  const saveBlocked =
    form.category_id === '' || sending || methodGone !== null || form.amount.trim() === '' || reason !== null
  const shownAmount = parseMoneyInput(form.amount, money.format)
  const saveLabel =
    shownAmount.ok && shownAmount.value > 0 ? (
      t('expenses:form.saveWithAmount', { amount: AMOUNT_MARK })
        .split(AMOUNT_MARK)
        .flatMap((part, at) => (at === 0 ? [part] : [<span key="amount" className="cifra-n gasto-form__monto">{money.money(shownAmount.value)}</span>, part]))
    ) : (
      t('expenses:form.save')
    )

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
    if (saveBlocked) return
    setFormError(null)
    setCategoryError(null)
    setOffline(false)
    const parsedAmount = parseMoneyInput(form.amount, money.format)
    if (!parsedAmount.ok) return
    const body: ExpenseInput = {
      spent_on: form.spent_on,
      category_id: Number(form.category_id),
      amount: parsedAmount.value,
      detail: detailTrimmed,
      payment_method_id: form.payment_method_id,
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
      } else if (caught instanceof ApiError && resolveOverride(EXPENSE_FORM_OVERRIDES, caught.code) === 'method-gone') {
        // Everything typed stays: only the field is marked, and Save waits for another pick or None.
        void queryClient.invalidateQueries({ queryKey: keys.paymentMethods() })
        const refused = body.payment_method_id
        if (refused === null) {
          setFormError(GENERIC_REFUSAL)
        } else {
          const name =
            storedMethod !== null && storedMethod.id === refused
              ? storedMethod.name
              : (paymentMethodName(queryClient, refused) ?? '')
          setMethodGone({ id: refused, name })
        }
      } else if (caught instanceof ApiError && isGone(caught.code)) {
        invalidateResource(queryClient, 'expenses')
        onGone?.()
      } else if (caught instanceof ApiError && caught.code === AMOUNT_REFUSAL_CODE) {
        setRefusal({ text: form.amount, message: tooManyDecimalsMessage(money.format) })
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
        <div className="campo">
          <label className="campo">
            <span className="campo__rotulo">{COMMON_TEXT.amount}</span>
            <MoneyInput
              ref={amountRef}
              className="campo__input campo__input--monto"
              autoComplete="off"
              value={form.amount}
              onChange={(amount) => {
                setBlurred(false)
                setForm((previous) => ({ ...previous, amount }))
              }}
              onBlur={() => setBlurred(true)}
              required
              aria-describedby={amountSentence === null ? undefined : amountReasonId}
              aria-invalid={amountSentence === null ? undefined : true}
            />
          </label>
          {amountSentence !== null && (
            <span key={amountSentence.rule} ref={amountReasonRef} id={amountReasonId} className="campo__error" role="alert">
              {amountSentence.text}
            </span>
          )}
        </div>
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
          <span className="campo__rotulo">{t('expenses:form.detailsOptional')}</span>
          <input
            className="campo__input"
            value={form.detail}
            autoComplete="off"
            maxLength={200}
            onChange={(event) => setForm((previous) => ({ ...previous, detail: event.target.value }))}
          />
        </label>
        <DateRow
          label={COMMON_TEXT.date}
          value={form.spent_on}
          today={me.today}
          onChange={(spent_on) => setForm((previous) => ({ ...previous, spent_on }))}
        />
        <div className="campo">
          <Selector
            {...methodOptions.selector}
            emptySetMessage={
              methodOptions.failure === null ? t('expenses:form.paymentMethodEmpty') : methodOptions.selector.emptySetMessage
            }
            label={t('expenses:form.paymentMethod')}
            emptyWording={t('expenses:form.paymentMethodNone')}
            options={methodView.options}
            value={methodView.value}
            selected={methodView.selected}
            loading={methodView.loading}
            onChange={(next) => {
              setMethodGone(null)
              setForm((previous) => ({ ...previous, payment_method_id: paymentMethodOf(next) }))
            }}
            onOpenChange={onMethodListOpenChange}
            describedBy={methodGone === null ? undefined : methodErrorId}
          />
          {methodGone !== null && <FieldRefusal id={methodErrorId}>{t('common:paymentMethodUnavailable')}</FieldRefusal>}
        </div>
        <SheetActions>
          {formError !== null && (
            <span className="campo__error" role="alert">
              {formError}
            </span>
          )}
          {offline && <SinConexion />}
          {phone && deleteButton}
          <Boton
            textOnly="submit"
            type="submit"
            ariaDisabled={saveBlocked}
            onClick={(event) => {
              if (!saveBlocked) return
              event.preventDefault()
              setBlurred(true)
              // A tap that shows the amount's reason leaves the cursor in the amount, keyboard up.
              if (reason !== null) amountRef.current?.focus()
            }}
          >
            {saveLabel}
          </Boton>
          {!phone && deleteButton}
        </SheetActions>
      </form>
    </div>
  )
}
