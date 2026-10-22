/**
 * The list, add, rename and remove of expense categories (`ConfiguracionCategorias.dc.html`,
 * `ConfiguracionCategoriasCompu.dc.html`; `docs/product/expenses.md`, "Expense category"), on its
 * own so the Configuración group and the Onboarding's categories step show the same thing.
 * Removing one still in use is refused with the fixed line; there is no archive or restore.
 * Renaming or removing a category a partner already removed answers
 * `expense_category.not_found` (kind `gone`): the row closes and the fixed gone notice shows,
 * never the generic refusal text.
 *
 * `dirty` is what is typed (a new name, or a rename draft that differs) against `accepted`:
 * the list the server last accepted, taken once from the first read and reset from each
 * save's own answer. It is never compared with the query cache, which a save invalidates and
 * a partner's edit can move under the form. The query is frozen for the same reason: the list
 * on screen is `accepted`, not whatever a refetch brings. The parent hears `dirty` through
 * `onDirtyChange`, and keeps its own chrome and its own leave question.
 *
 * `addCollapsed` (the Onboarding's step 6, `OnboardingCategorias.dc.html`): the "New category"
 * field starts closed behind an add action, and a saved add closes it again; the submit and the
 * owner's POST are the same. With it off (Configuración) the field is always there, as drawn.
 */

import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError, UNKNOWN_CODE } from '../../api/client'
import {
  type ExpenseCategory,
  addCategory,
  listCategories,
  removeCategory,
  renameCategory,
} from '../../api/expenses'
import { invalidateResource, keys } from '../../api/keys'
import { isGone, kindOf, resolveOverride, type RefusalCode } from '../../api/refusals'
import Aviso, { type SuccessToast } from '../../components/Aviso'
import Boton from '../../components/Boton'
import AnswerButton from '../../components/AnswerButton'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import GoneNotice from '../../components/GoneNotice'
import SinConexion from '../../components/SinConexion'
import Loading from '../../components/Loading'
import { CATEGORIES_SAVE_AT_ONCE, GENERIC_REFUSAL_MESSAGE, SETTINGS_TEXT } from '../../copy/settings'
import { COMMON_TEXT } from '../../copy/common'

export const CANNOT_REMOVE = SETTINGS_TEXT.cannotDeleteStillHasExpenses

const REMOVE_OVERRIDES: Partial<Record<RefusalCode, 'in-use'>> = {
  'expense_category.in_use': 'in-use',
}

function isRefusal(caught: unknown): caught is ApiError {
  return caught instanceof ApiError && caught.code !== UNKNOWN_CODE && kindOf(caught.code) === 'refusal'
}

export default function ExpenseCategoriesEditor({
  onDirtyChange,
  addCollapsed = false,
}: {
  onDirtyChange: (dirty: boolean) => void
  addCollapsed?: boolean
}) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: keys.expenseCategories(),
    queryFn: listCategories,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  if (data === undefined) {
    return (
      <>
        {isPending && <Loading />}
        {isError && (error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />)}
      </>
    )
  }
  return <Categories initial={data} onDirtyChange={onDirtyChange} addCollapsed={addCollapsed} />
}

/** The server orders by the case-folded name (binary); the list keeps that order after an add or a rename. */
function byNameKey(categories: ExpenseCategory[]): ExpenseCategory[] {
  const key = (category: ExpenseCategory): string => category.name.toLowerCase()
  return [...categories].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0))
}

function Categories({
  initial,
  onDirtyChange,
  addCollapsed,
}: {
  initial: ExpenseCategory[]
  onDirtyChange: (dirty: boolean) => void
  addCollapsed: boolean
}) {
  const queryClient = useQueryClient()
  const [accepted, setAccepted] = useState(initial)
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [toast, setToast] = useState<SuccessToast | null>(null)
  const [goneNotice, setGoneNotice] = useState(false)
  const [sending, setSending] = useState(false)
  const [adding, setAdding] = useState(!addCollapsed)
  const addRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const focusAddAction = useRef(false)

  const dirty =
    newName !== '' ||
    accepted.some((category) => {
      const draft = drafts[category.id]
      return draft !== undefined && draft !== category.name
    })

  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  // Opening the field moves focus into it; closing it after a save gives focus back to the add action.
  useEffect(() => {
    if (!addCollapsed) return
    if (adding) {
      inputRef.current?.focus()
    } else if (focusAddAction.current) {
      focusAddAction.current = false
      addRef.current?.querySelector('button')?.focus()
    }
  }, [adding, addCollapsed])

  function flash(message: SuccessToast): void {
    setToast(message)
    setTimeout(() => setToast(null), 2500)
  }

  function flashGone(): void {
    setGoneNotice(true)
    setTimeout(() => setGoneNotice(false), 2500)
  }

  function setDraft(id: number, name: string | undefined): void {
    setDrafts((previous) => {
      const next = { ...previous }
      if (name === undefined) delete next[id]
      else next[id] = name
      return next
    })
  }

  function accept(next: ExpenseCategory[]): void {
    setAccepted(byNameKey(next))
    invalidateResource(queryClient, 'expenseCategories')
  }

  function drop(id: number): void {
    setDraft(id, undefined)
    accept(accepted.filter((category) => category.id !== id))
  }

  async function onAdd(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    setOffline(false)
    setSending(true)
    try {
      const created = await addCategory(newName)
      accept([...accepted, created])
      setNewName('')
      if (addCollapsed) {
        focusAddAction.current = true
        setAdding(false)
      }
      flash(SETTINGS_TEXT.categorySaved)
    } catch (caught) {
      if (caught instanceof NetworkError) setOffline(true)
      else if (isRefusal(caught)) setError(GENERIC_REFUSAL_MESSAGE)
      else setError(ERROR_GENERICO_MENSAJE)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div>
        {accepted.map((category) => (
          <CategoryRow
            key={category.id}
            category={category}
            draft={drafts[category.id]}
            onDraft={(name) => setDraft(category.id, name)}
            onRenamed={(renamed) => {
              setDraft(category.id, undefined)
              accept(accepted.map((each) => (each.id === renamed.id ? renamed : each)))
              flash(SETTINGS_TEXT.categorySaved)
            }}
            onRemoved={() => {
              drop(category.id)
              flash(SETTINGS_TEXT.categoryDeleted)
            }}
            onGone={() => {
              drop(category.id)
              flashGone()
            }}
          />
        ))}
      </div>

      {adding ? (
        <form className="formulario" onSubmit={onAdd}>
          <label className="campo">
            <span className="campo__rotulo">{SETTINGS_TEXT.newCategory}</span>
            <input
              ref={inputRef}
              className="campo__input"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
          </label>
          {error !== null && (
            <span className="campo__error" role="alert">
              {error}
            </span>
          )}
          {offline && <SinConexion />}
          <Boton variant="secondary" textOnly="submit" type="submit" disabled={sending || newName.trim() === ''}>
            {SETTINGS_TEXT.addCategory}
          </Boton>
        </form>
      ) : (
        <div ref={addRef}>
          <Boton variant="secondary" icon="agregar" onClick={() => setAdding(true)}>
            {COMMON_TEXT.category}
          </Boton>
        </div>
      )}
      {addCollapsed && (
        <span className="campo__rotulo" data-copy="help">
          {CATEGORIES_SAVE_AT_ONCE}
        </span>
      )}

      {toast !== null && <Aviso texto={toast} />}
      {goneNotice && (
        <div className="aviso-flotante">
          <GoneNotice />
        </div>
      )}
    </>
  )
}

function CategoryRow({
  category,
  draft,
  onDraft,
  onRenamed,
  onRemoved,
  onGone,
}: {
  category: ExpenseCategory
  draft: string | undefined
  onDraft: (name: string | undefined) => void
  onRenamed: (renamed: ExpenseCategory) => void
  onRemoved: () => void
  onGone: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    setOffline(false)
    setSending(true)
    try {
      onRenamed(await renameCategory(category.id, draft ?? category.name))
    } catch (caught) {
      if (caught instanceof NetworkError) {
        setOffline(true)
      } else if (caught instanceof ApiError && isGone(caught.code)) {
        onGone()
      } else if (isRefusal(caught)) {
        setError(GENERIC_REFUSAL_MESSAGE)
      } else {
        setError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSending(false)
    }
  }

  async function remove(): Promise<void> {
    setSending(true)
    try {
      await removeCategory(category.id)
      onRemoved()
    } catch (caught) {
      setConfirming(false)
      if (caught instanceof ApiError && resolveOverride(REMOVE_OVERRIDES, caught.code) === 'in-use') {
        setError(CANNOT_REMOVE)
      } else if (caught instanceof NetworkError) {
        setOffline(true)
      } else if (caught instanceof ApiError && isGone(caught.code)) {
        onGone()
      } else if (isRefusal(caught)) {
        setError(GENERIC_REFUSAL_MESSAGE)
      } else {
        setError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSending(false)
    }
  }

  if (draft !== undefined) {
    return (
      <form className="fila" onSubmit={save}>
        <input
          className="campo__input"
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          aria-label={SETTINGS_TEXT.nameOf(category.name)}
        />
        <Boton textOnly="submit" type="submit" disabled={sending}>
          {COMMON_TEXT.save}
        </Boton>
        {error !== null && (
          <span className="campo__error" role="alert">
            {error}
          </span>
        )}
        {offline && <SinConexion />}
      </form>
    )
  }

  return (
    <div className="fila">
      <span className="categoria-fila__nombre">{category.name}</span>
      <span className="categoria-fila__accion">
        <Boton variant="icon" action="edit" ariaLabel={SETTINGS_TEXT.rename} onClick={() => onDraft(category.name)} />
      </span>
      <Boton variant="icon" action="delete" ariaLabel={SETTINGS_TEXT.delete} onClick={() => setConfirming(true)} />
      {error !== null && (
        <span className="campo__error" role="alert">
          {error}
        </span>
      )}
      {offline && <SinConexion />}
      {confirming && (
        <div className="capa" role="presentation">
          <div className="capa__contenido panel">
            <span className="panel__titulo">{SETTINGS_TEXT.deleteTheCategory}</span>
            <span className="panel__detalle">
              {SETTINGS_TEXT.thisDeletes}{category.name}{SETTINGS_TEXT.closingQuoteCannotUndo}
            </span>
            <div className="panel__botones">
              <AnswerButton kind="keep" onClick={() => setConfirming(false)}>
                {COMMON_TEXT.noKeep}
              </AnswerButton>
              <AnswerButton kind="confirm" disabled={sending} onClick={remove}>
                {COMMON_TEXT.yesDelete}
              </AnswerButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
