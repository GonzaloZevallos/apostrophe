/**
 * `WithdrawalForm`: "Sacar del stock" (`stock.md`, "Stock withdrawal"), shared by the
 * new and edit routes. It knows nothing about where it is shown: its host supplies every
 * exit (`onDone`, `onCancel`, `onGone`) and learns whether something was typed through
 * `onDirtyChange`, so the host alone decides how leaving works (as `ExpenseForm` does).
 *
 * The reason has no default: it is chosen every time, and saving stays off until it is.
 * Grams are typed text and travel as the decimal string `parseGrams` returns, never as a
 * JS number. Editing confirms before saving. The form saves, but never navigates or toasts.
 */

import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router'
import { ApiError, NetworkError, UNKNOWN_CODE, get } from '../../api/client'
import { invalidateResource, keys } from '../../api/keys'
import type { Me } from '../../api/me'
import {
  GONE_DETAIL,
  WITHDRAWAL_REFUSAL_MESSAGES,
  isGone,
  kindOf,
  resolveOverride,
  type RefusalCode,
} from '../../api/refusals'
import {
  type Withdrawal,
  type WithdrawalInput,
  type WithdrawalReason,
  editWithdrawal,
  recordWithdrawal,
} from '../../api/stock'
import type { SuccessToast } from '../../components/AvisoExito'
import ConfirmDialog from '../../components/ConfirmDialog'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import { SheetActions } from '../../components/Sheet'
import SinConexion from '../../components/SinConexion'
import { parseGrams } from '../../format/parse'
import { exceedsDecimals, useDecimalsSentence } from '../../format/unitDecimals'
import { guiltyKeys, keptOptions, preselected } from './goneLines'
import { REASON_OPTIONS } from './withdrawalReasons'
import type { Variety } from '../Variedades'
import Boton from '../../components/Boton'
import { GRAMS_INVALID, STOCK_TEXT } from '../../copy/stock'
import { COMMON_TEXT } from '../../copy/common'
import { GENERIC_REFUSAL_MESSAGE } from '../../copy/settings'
import { useTranslation } from 'react-i18next'
import { refusalText, type Refusal } from '../../i18n/refusalKeys'

export const GENERIC_REFUSAL = GENERIC_REFUSAL_MESSAGE

const REFUSAL_MESSAGES: Partial<Record<RefusalCode, Refusal>> = WITHDRAWAL_REFUSAL_MESSAGES

export type WithdrawalTarget = 'new' | Withdrawal

interface LineState {
  key: number
  varietyId: string
  grams: string
}

interface FormState {
  reason: WithdrawalReason | ''
  date: string
  lines: LineState[]
  note: string
  /** Lines a successfully fetched list confirms archived: saving waits until they change. */
  gone: ReadonlySet<number>
  /** Lines a refusal blamed while the list could not be fetched: a tap re-checks first. */
  suspect: ReadonlySet<number>
}

const NONE: ReadonlySet<number> = new Set()

function initialState(target: WithdrawalTarget, today: string, varietyId: string): FormState {
  if (target === 'new') {
    return {
      reason: '',
      date: today,
      lines: [{ key: 0, varietyId, grams: '' }],
      note: '',
      gone: NONE,
      suspect: NONE,
    }
  }
  return {
    reason: target.reason,
    date: target.date,
    lines: target.lines.map((line, index) => ({
      key: index,
      varietyId: String(line.product_id),
      grams: String(line.quantity),
    })),
    note: target.note ?? '',
    gone: NONE,
    suspect: NONE,
  }
}

/** The varieties the stored withdrawal already had on a line: an edit may keep them. */
function storedIdsOf(target: WithdrawalTarget): ReadonlySet<string> {
  if (target === 'new') return new Set()
  return new Set(target.lines.map((line) => String(line.product_id)))
}

/** Name by id, seeded from the stored lines and filled from every list that loads. */
function seededNames(target: WithdrawalTarget): Map<string, string> {
  const names = new Map<string, string>()
  if (target !== 'new') {
    for (const line of target.lines) names.set(String(line.product_id), line.product_name)
  }
  return names
}

function without(keys: ReadonlySet<number>, key: number): ReadonlySet<number> {
  if (!keys.has(key)) return keys
  const rest = new Set(keys)
  rest.delete(key)
  return rest
}

function withFirstVariety(state: FormState, varietyId: string): FormState {
  return {
    ...state,
    lines: state.lines.map((line, index) => (index === 0 ? { ...line, varietyId } : line)),
  }
}

/** Keys of `keys` whose line in `form` still holds the variety it held in `sent`. */
function unchangedSince(form: FormState, sent: readonly LineState[], keys: Iterable<number>): Set<number> {
  const kept = new Set<number>()
  for (const key of keys) {
    const before = sent.find((line) => line.key === key)
    const now = form.lines.find((line) => line.key === key)
    if (before !== undefined && now !== undefined && now.varietyId === before.varietyId) kept.add(key)
  }
  return kept
}

const fetchVarieties = () => get<Variety[]>('/api/products')

/** Equal by what was typed: the lines' keys are only React's. */
function sameForm(a: FormState, b: FormState): boolean {
  return (
    a.reason === b.reason &&
    a.date === b.date &&
    a.note === b.note &&
    a.lines.length === b.lines.length &&
    a.lines.every((line, index) => {
      const other = b.lines[index]
      return other !== undefined && line.varietyId === other.varietyId && line.grams === other.grams
    })
  )
}

export interface WithdrawalFormProps {
  target: WithdrawalTarget
  /** The variety the first line starts with (`?variety=`); only read for a new withdrawal. */
  initialVarietyId?: string
  onDone: (saved: SuccessToast) => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
  onGone: () => void
}

export default function WithdrawalForm({
  target,
  initialVarietyId = '',
  onDone,
  onCancel,
  onDirtyChange,
  onGone,
}: WithdrawalFormProps) {
  const me = useOutletContext<Me>()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const decimalsSentence = useDecimalsSentence()
  const varietiesQuery = useQuery({
    queryKey: keys.varieties(),
    queryFn: fetchVarieties,
  })
  const [initial, setInitial] = useState<FormState>(() => initialState(target, me.today, initialVarietyId))
  const [form, setForm] = useState<FormState>(initial)
  const [storedIds] = useState(() => storedIdsOf(target))
  const [names] = useState(() => seededNames(target))
  const [preselectChecked, setPreselectChecked] = useState(false)
  const [seenAt, setSeenAt] = useState(0)
  const messageId = useId()
  const nextKey = useRef(initial.lines.length)
  const [formError, setFormError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [sending, setSending] = useState(false)
  const [confirmingSave, setConfirmingSave] = useState(false)

  const dirty = !sameForm(form, initial)
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  const loaded = varietiesQuery.data
  const varieties = loaded ?? []
  const listedAt = varietiesQuery.dataUpdatedAt
  const listFailed = varietiesQuery.isError

  // Opened with a variety that is archived or unknown: no variety chosen, nothing dirty.
  // The form of a new withdrawal is not drawn before the list loads, so nothing was touched.
  // (State adjusted while rendering, as React documents it: no extra frame, no effect.)
  if (target === 'new' && loaded !== undefined && !preselectChecked) {
    setPreselectChecked(true)
    const chosen = preselected(initialVarietyId, new Set(loaded.map((variety) => String(variety.id))))
    if (chosen !== initialVarietyId) {
      setInitial((previous) => withFirstVariety(previous, chosen))
      setForm((previous) => withFirstVariety(previous, chosen))
    }
  }

  // Every list that loads feeds the names a kept line shows, and re-reads the lines already
  // marked (never the others: a line is blamed only after the server refused it). A failed
  // list never gets here: its `dataUpdatedAt` does not move.
  if (loaded !== undefined && !listFailed && listedAt !== seenAt) {
    setSeenAt(listedAt)
    for (const variety of loaded) names.set(String(variety.id), variety.name)
    const fresh = new Set(loaded.map((variety) => String(variety.id)))
    setForm((previous) => {
      if (previous.gone.size === 0 && previous.suspect.size === 0) return previous
      const markedLines = previous.lines.filter(
        (line) => previous.gone.has(line.key) || previous.suspect.has(line.key),
      )
      return { ...previous, gone: guiltyKeys(markedLines, fresh, storedIds), suspect: NONE }
    })
  }

  const complete =
    form.reason !== '' &&
    form.lines.every((line) => line.varietyId !== '' && line.grams.trim() !== '')
  const canSubmit = complete && loaded !== undefined && form.gone.size === 0 && !sending

  function setLine(key: number, change: Partial<LineState>): void {
    setForm((previous) => {
      const before = previous.lines.find((line) => line.key === key)
      const moved = change.varietyId !== undefined && before?.varietyId !== change.varietyId
      return {
        ...previous,
        lines: previous.lines.map((line) => (line.key === key ? { ...line, ...change } : line)),
        ...(moved ? { gone: without(previous.gone, key), suspect: without(previous.suspect, key) } : {}),
      }
    })
  }

  /** The list again, now: `null` when it could not be fetched (and the form says so). */
  async function freshList(): Promise<Variety[] | null> {
    try {
      return await queryClient.fetchQuery({
        queryKey: keys.varieties(),
        queryFn: fetchVarieties,
        staleTime: 0,
      })
    } catch (caught) {
      if (caught instanceof NetworkError) setOffline(true)
      else setFormError(ERROR_GENERICO_MENSAJE)
      return null
    }
  }

  /** A save was refused as `variety.archived`: learn from a fresh list which line it was. */
  async function settleArchived(sent: readonly LineState[]): Promise<void> {
    const fresh = await freshList()
    if (fresh === null) {
      // Not knowing is not clearing: every line that could be the one stays blamed.
      const doubtful = sent.filter((line) => line.varietyId !== '' && !storedIds.has(line.varietyId))
      setForm((previous) => ({
        ...previous,
        suspect: unchangedSince(previous, sent, doubtful.map((line) => line.key)),
      }))
      return
    }
    const guilty = guiltyKeys(sent, new Set(fresh.map((variety) => String(variety.id))), storedIds)
    if (guilty.size === 0) {
      setFormError(GENERIC_REFUSAL)
      return
    }
    setForm((previous) => ({
      ...previous,
      gone: unchangedSince(previous, sent, guilty),
      suspect: NONE,
    }))
  }

  /** A tap while some line is only suspected: re-read the list, and send only if none is left. */
  async function recheckThenSend(): Promise<void> {
    setFormError(null)
    setOffline(false)
    setSending(true)
    const sent = form.lines
    let clear = false
    try {
      const fresh = await freshList()
      if (fresh === null) return
      const marked = sent.filter((line) => form.gone.has(line.key) || form.suspect.has(line.key))
      const guilty = guiltyKeys(marked, new Set(fresh.map((variety) => String(variety.id))), storedIds)
      setForm((previous) => ({
        ...previous,
        gone: unchangedSince(previous, sent, guilty),
        suspect: NONE,
      }))
      clear = guilty.size === 0
    } finally {
      setSending(false)
    }
    if (clear) proceed()
  }

  /** What the unit of the line's product allows, when the typed quantity has more decimals. */
  function finerThanUnit(line: LineState): number | null {
    const decimals = varieties.find((variety) => String(variety.id) === line.varietyId)?.unit?.decimals
    return decimals !== undefined && exceedsDecimals(line.grams, decimals) ? decimals : null
  }

  function proceed(): void {
    if (form.lines.some((line) => finerThanUnit(line) !== null)) return
    if (target === 'new') void save()
    else setConfirmingSave(true)
  }

  function buildBody(): WithdrawalInput | null {
    if (form.reason === '') return null
    const lines: WithdrawalInput['lines'] = []
    for (const line of form.lines) {
      const grams = parseGrams(line.grams)
      const varietyId = Number(line.varietyId)
      if (!grams.ok || !Number.isInteger(varietyId)) return null
      lines.push({ product_id: varietyId, quantity: grams.value })
    }
    const note = form.note.trim()
    return {
      reason: form.reason,
      date: form.date,
      lines,
      ...(note === '' ? {} : { note }),
    }
  }

  async function save(): Promise<void> {
    setConfirmingSave(false)
    const body = buildBody()
    if (body === null) {
      setFormError(GRAMS_INVALID)
      return
    }
    setFormError(null)
    setOffline(false)
    setSending(true)
    const sent = form.lines
    try {
      if (target === 'new') await recordWithdrawal(body)
      else await editWithdrawal(String(target.id), body)
      invalidateResource(queryClient, 'stock')
      onDone(STOCK_TEXT.retiroGuardado)
    } catch (caught) {
      if (caught instanceof NetworkError) {
        setOffline(true)
      } else if (caught instanceof ApiError) {
        const message = resolveOverride(REFUSAL_MESSAGES, caught.code)
        if (caught.code === 'stock.withdrawal_variety_not_found') {
          // The withdrawal itself still has somewhere to go: only a line's variety is gone.
          invalidateResource(queryClient, 'varieties')
          setFormError(message === undefined ? GENERIC_REFUSAL : refusalText(t, message))
        } else if (caught.code === 'variety.archived') {
          // Before the generic gone branch: the withdrawal is fine, a line's variety is not.
          await settleArchived(sent)
        } else if (isGone(caught.code)) {
          invalidateResource(queryClient, 'stock')
          onGone()
        } else if (caught.code === 'quantity.too_many_decimals') {
          setFormError(t('units:quantityRefused'))
        } else if (message !== undefined) {
          setFormError(refusalText(t, message))
        } else {
          setFormError(
            caught.code !== UNKNOWN_CODE && kindOf(caught.code) === 'refusal'
              ? GENERIC_REFUSAL
              : ERROR_GENERICO_MENSAJE,
          )
        }
      } else {
        setFormError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSending(false)
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (!canSubmit) return
    if (form.suspect.size > 0) void recheckThenSend()
    else proceed()
  }

  const marked = (key: number): boolean => form.gone.has(key) || form.suspect.has(key)

  const header = (
    <div className="gasto-form__cabecera">
      <span className="gasto-form__titulo">{COMMON_TEXT.takeFromStock}</span>
      <span className="gasto-form__cerrar">
        <Boton variant="icon" action="close" ariaLabel={COMMON_TEXT.close} onClick={onCancel} />
      </span>
    </div>
  )

  if (listFailed && loaded === undefined) {
    return (
      <div className="gasto-form">
        {header}
        {varietiesQuery.error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />}
      </div>
    )
  }
  // A new withdrawal waits for the list (its picker is all it has); an edit already has
  // its lines, with their names, so it shows them while the list is on its way.
  if (loaded === undefined && target === 'new') return <div className="gasto-form">{header}</div>

  return (
    <div className="gasto-form">
      {header}
      <form className="formulario" onSubmit={onSubmit}>
        <fieldset className="campo">
          <legend className="campo__rotulo">{STOCK_TEXT.motivo}</legend>
          <div className="origen-pildoras">
            {REASON_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={form.reason === option.value ? 'pildora pildora--activa' : 'pildora'}
                aria-pressed={form.reason === option.value}
                onClick={() => setForm((previous) => ({ ...previous, reason: option.value }))}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="campo">
          <span className="campo__rotulo">{COMMON_TEXT.date}</span>
          <input
            className="campo__input"
            type="date"
            value={form.date}
            max={me.today}
            onChange={(event) => setForm((previous) => ({ ...previous, date: event.target.value }))}
            required
          />
        </label>
        {form.lines.map((line, index) => {
          const finerDecimals = finerThanUnit(line)
          return (
          <fieldset className="campo" key={line.key}>
            <legend className="campo__rotulo">
              {form.lines.length === 1 ? STOCK_TEXT.variedadYGramos : STOCK_TEXT.variedadYGramos0(index + 1)}
            </legend>
            <select
              className="campo__input"
              aria-label={STOCK_TEXT.variedad0(index + 1)}
              aria-describedby={marked(line.key) ? `${messageId}-${line.key}` : undefined}
              value={line.varietyId}
              onChange={(event) => setLine(line.key, { varietyId: event.target.value })}
              required
            >
              <option value="">{COMMON_TEXT.pickAVariety}</option>
              {keptOptions([line], varieties, names).map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))}
            </select>
            {marked(line.key) && (
              <span className="campo__error" role="alert" id={`${messageId}-${line.key}`}>
                {refusalText(t, GONE_DETAIL)}
              </span>
            )}
            <input
              className="campo__input"
              aria-label={STOCK_TEXT.gramos0(index + 1)}
              inputMode="decimal"
              enterKeyHint={index === form.lines.length - 1 ? 'done' : 'next'}
              value={line.grams}
              onChange={(event) => setLine(line.key, { grams: event.target.value })}
              aria-invalid={finerDecimals !== null || undefined}
              required
            />
            {finerDecimals !== null && (
              <span className="campo__error" role="alert">
                {decimalsSentence(finerDecimals)}
              </span>
            )}
            {form.lines.length > 1 && (
              <Boton
                variant="icon"
                action="delete"
                ariaLabel={STOCK_TEXT.quitarVariedad0(index + 1)}
                onClick={() =>
                  setForm((previous) => ({
                    ...previous,
                    lines: previous.lines.filter((other) => other.key !== line.key),
                    gone: without(previous.gone, line.key),
                    suspect: without(previous.suspect, line.key),
                  }))
                }
              />
            )}
          </fieldset>
          )
        })}
        <Boton
          variant="secondary"
          icon="agregar"
          onClick={() => {
            const key = nextKey.current
            nextKey.current += 1
            setForm((previous) => ({
              ...previous,
              lines: [...previous.lines, { key, varietyId: '', grams: '' }],
            }))
          }}
        >
          {COMMON_TEXT.addAnotherVariety}
        </Boton>
        <label className="campo">
          <span className="campo__rotulo">{COMMON_TEXT.note}</span>
          <input
            className="campo__input"
            value={form.note}
            maxLength={200}
            enterKeyHint="done"
            onChange={(event) => setForm((previous) => ({ ...previous, note: event.target.value }))}
          />
        </label>
        <SheetActions>
          {formError !== null && (
            <span className="campo__error" role="alert">
              {formError}
            </span>
          )}
          {offline && <SinConexion />}
          <Boton textOnly="submit" type="submit" disabled={!canSubmit}>
            {target === 'new' ? STOCK_TEXT.guardaElRetiro : COMMON_TEXT.save}
          </Boton>
        </SheetActions>
      </form>
      {confirmingSave && (
        <ConfirmDialog
          title={STOCK_TEXT.guardasLosCambios}
          detail={STOCK_TEXT.estoActualizaElRetiro}
          confirmText={STOCK_TEXT.siGuardar}
          cancelText={STOCK_TEXT.noSeguirEditando}
          onConfirm={() => {
            if (!sending) void save()
          }}
          onCancel={() => setConfirmingSave(false)}
        />
      )}
    </div>
  )
}
