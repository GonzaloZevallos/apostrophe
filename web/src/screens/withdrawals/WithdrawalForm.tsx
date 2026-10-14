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

import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext } from 'react-router'
import { ApiError, NetworkError, UNKNOWN_CODE, get } from '../../api/client'
import { invalidateResource, keys } from '../../api/keys'
import type { Me } from '../../api/me'
import {
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
import SinConexion from '../../components/SinConexion'
import { parseGrams } from '../../format/parse'
import { REASON_OPTIONS } from './withdrawalReasons'
import type { Variety } from '../Variedades'
import { GRAMS_INVALID_MESSAGE } from '../stockMessages'
import Boton from '../../components/Boton'

export const GENERIC_REFUSAL = 'Revisá los datos e intentá de nuevo.'

const REFUSAL_MESSAGES: Partial<Record<RefusalCode, string>> = WITHDRAWAL_REFUSAL_MESSAGES

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
}

function initialState(target: WithdrawalTarget, today: string, varietyId: string): FormState {
  if (target === 'new') {
    return {
      reason: '',
      date: today,
      lines: [{ key: 0, varietyId, grams: '' }],
      note: '',
    }
  }
  return {
    reason: target.reason,
    date: target.date,
    lines: target.lines.map((line, index) => ({
      key: index,
      varietyId: String(line.variety_id),
      grams: String(line.grams),
    })),
    note: target.note ?? '',
  }
}

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
  const varietiesQuery = useQuery({
    queryKey: keys.varieties(),
    queryFn: () => get<Variety[]>('/varieties'),
  })
  const [initial] = useState<FormState>(() => initialState(target, me.today, initialVarietyId))
  const [form, setForm] = useState<FormState>(initial)
  const nextKey = useRef(initial.lines.length)
  const [formError, setFormError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [sending, setSending] = useState(false)
  const [confirmingSave, setConfirmingSave] = useState(false)

  const dirty = !sameForm(form, initial)
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  const varieties = varietiesQuery.data ?? []
  const complete =
    form.reason !== '' &&
    form.lines.every((line) => line.varietyId !== '' && line.grams.trim() !== '')
  const canSubmit = complete && !sending

  function setLine(key: number, change: Partial<LineState>): void {
    setForm((previous) => ({
      ...previous,
      lines: previous.lines.map((line) => (line.key === key ? { ...line, ...change } : line)),
    }))
  }

  function buildBody(): WithdrawalInput | null {
    if (form.reason === '') return null
    const lines: WithdrawalInput['lines'] = []
    for (const line of form.lines) {
      const grams = parseGrams(line.grams)
      const varietyId = Number(line.varietyId)
      if (!grams.ok || !Number.isInteger(varietyId)) return null
      lines.push({ variety_id: varietyId, grams: grams.value })
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
      setFormError(GRAMS_INVALID_MESSAGE)
      return
    }
    setFormError(null)
    setOffline(false)
    setSending(true)
    try {
      if (target === 'new') await recordWithdrawal(body)
      else await editWithdrawal(String(target.id), body)
      invalidateResource(queryClient, 'stock')
      onDone('Retiro guardado')
    } catch (caught) {
      if (caught instanceof NetworkError) {
        setOffline(true)
      } else if (caught instanceof ApiError) {
        const message = resolveOverride(REFUSAL_MESSAGES, caught.code)
        if (caught.code === 'stock.withdrawal_variety_not_found') {
          // The withdrawal itself still has somewhere to go: only a line's variety is gone.
          invalidateResource(queryClient, 'varieties')
          setFormError(message ?? GENERIC_REFUSAL)
        } else if (isGone(caught.code)) {
          invalidateResource(queryClient, 'stock')
          onGone()
        } else if (message !== undefined) {
          setFormError(message)
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
    if (target === 'new') void save()
    else setConfirmingSave(true)
  }

  const header = (
    <div className="gasto-form__cabecera">
      <span className="gasto-form__titulo">Sacar del stock</span>
      <span className="gasto-form__cerrar">
        <Boton variant="icon" action="close" ariaLabel="Cerrar" onClick={onCancel} />
      </span>
    </div>
  )

  if (varietiesQuery.isError) {
    return (
      <div className="gasto-form">
        {header}
        {varietiesQuery.error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />}
      </div>
    )
  }
  if (varietiesQuery.data === undefined) return <div className="gasto-form">{header}</div>

  return (
    <div className="gasto-form">
      {header}
      <form className="formulario" onSubmit={onSubmit}>
        <fieldset className="campo">
          <legend className="campo__rotulo">Motivo</legend>
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
          <span className="campo__rotulo">Fecha</span>
          <input
            className="campo__input"
            type="date"
            value={form.date}
            max={me.today}
            onChange={(event) => setForm((previous) => ({ ...previous, date: event.target.value }))}
            required
          />
        </label>
        {form.lines.map((line, index) => (
          <fieldset className="campo" key={line.key}>
            <legend className="campo__rotulo">
              {form.lines.length === 1 ? 'Variedad y gramos' : `Variedad y gramos ${index + 1}`}
            </legend>
            <select
              className="campo__input"
              aria-label={`Variedad ${index + 1}`}
              value={line.varietyId}
              onChange={(event) => setLine(line.key, { varietyId: event.target.value })}
              required
            >
              <option value="">Elegí una variedad</option>
              {varieties.map((variety) => (
                <option key={variety.id} value={variety.id}>
                  {variety.name}
                </option>
              ))}
            </select>
            <input
              className="campo__input"
              aria-label={`Gramos ${index + 1}`}
              inputMode="decimal"
              enterKeyHint={index === form.lines.length - 1 ? 'done' : 'next'}
              value={line.grams}
              onChange={(event) => setLine(line.key, { grams: event.target.value })}
              required
            />
            {form.lines.length > 1 && (
              <Boton
                variant="icon"
                action="delete"
                ariaLabel={`Quitar variedad ${index + 1}`}
                onClick={() =>
                  setForm((previous) => ({
                    ...previous,
                    lines: previous.lines.filter((other) => other.key !== line.key),
                  }))
                }
              />
            )}
          </fieldset>
        ))}
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
          Agregar otra variedad
        </Boton>
        <label className="campo">
          <span className="campo__rotulo">Nota</span>
          <input
            className="campo__input"
            value={form.note}
            maxLength={200}
            enterKeyHint="done"
            onChange={(event) => setForm((previous) => ({ ...previous, note: event.target.value }))}
          />
        </label>
        {formError !== null && (
          <span className="campo__error" role="alert">
            {formError}
          </span>
        )}
        {offline && <SinConexion />}
        <Boton textOnly="submit" type="submit" disabled={!canSubmit}>
          {target === 'new' ? 'Guardá el retiro' : 'Guardar'}
        </Boton>
      </form>
      {confirmingSave && (
        <ConfirmDialog
          title="¿Guardás los cambios?"
          detail="Esto actualiza el retiro y los lotes que vienen después."
          confirmText="Sí, guardar"
          cancelText="No, seguir editando"
          onConfirm={() => {
            if (!sending) void save()
          }}
          onCancel={() => setConfirmingSave(false)}
        />
      )}
    </div>
  )
}
