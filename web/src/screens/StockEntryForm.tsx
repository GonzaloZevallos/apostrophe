/**
 * `StockEntryForm`: the body of `EntradaStock` (`stock.md`, "On screen") as a component of its
 * own, so another screen can host the same form under the same rules: date, variety with
 * "Hoy tiene N g", grams, origin, total cost with "Obligatorio cuando es una compra", note, the
 * cost-per-gram preview, the owner's refusals, the edit confirmation and the delete
 * confirmation, all through the owner's routes (`api/stock`). It owns no chrome and no
 * navigation: the host learns what happened through `onSaved`, `onDeleted`, `onGone` and
 * `onDirtyChange`. A `fixedVarietyId` locks the variety and a `fixedOrigin` removes the
 * choice of origin; a host that only wants a starting point passes the `preselected*` ones.
 * Its dialogs sit inline after the form, or in `dialogHost` when the host wants them
 * elsewhere in its own markup.
 */

import { type FormEvent, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError, UNKNOWN_CODE, get } from '../api/client'
import { invalidateResource, keys } from '../api/keys'
import { isGone, resolveOverride, type RefusalCode } from '../api/refusals'
import { type Origin, type StockEntry, deleteEntry, editEntry, readStock, recordEntry } from '../api/stock'
import { costPerGram, gramsToHundredths } from '../domain/costPerGram'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import SinConexion from '../components/SinConexion'
import { formatDate } from '../format/dates'
import { formatGrams, formatMoney } from '../format/money'
import { parseMoney, parseSignedGrams } from '../format/parse'
import type { Variety } from './Variedades'

export const GENERIC_REFUSAL = 'Revisá los datos e intentá de nuevo.'
export const COST_REQUIRED = 'Una compra necesita un costo total'
export const COST_ON_NEGATIVE = 'Un ajuste negativo no lleva costo'
export const DATE_IN_FUTURE = 'La fecha no puede ser futura'
export const GRAMS_INVALID = 'Revisá los gramos cargados'

const ORIGIN_OPTIONS: { value: Origin; label: string }[] = [
  { value: 'purchase', label: 'Compra' },
  { value: 'harvest', label: 'Cosecha' },
  { value: 'opening_stock', label: 'Stock inicial' },
  { value: 'adjustment', label: 'Ajuste' },
]

const FIELD_OVERRIDES: Partial<Record<RefusalCode, string>> = {
  'stock.cost_required': COST_REQUIRED,
  'stock.cost_on_negative_adjustment': COST_ON_NEGATIVE,
  'stock.date_in_future': DATE_IN_FUTURE,
  'stock.grams_invalid': GRAMS_INVALID,
  'stock.cost_invalid': GENERIC_REFUSAL,
  'stock.note_too_long': GENERIC_REFUSAL,
}

export interface StockEntryFormProps {
  mode: 'nuevo' | 'editar'
  today: string
  /** The entry being edited (`mode="editar"`). */
  initial?: StockEntry
  entryId?: string
  /** A starting choice the person can still change. */
  preselectedVarietyId?: number
  preselectedOrigin?: Origin
  /** A choice the person cannot change: the variety is locked, the origin is not offered. */
  fixedVarietyId?: number
  fixedOrigin?: 'opening_stock'
  /** Called after the entry is saved (and the stock queries marked stale). */
  onSaved: () => void
  /** Called after the entry is deleted (and the stock queries marked stale). */
  onDeleted?: () => void
  /** Called when the entry is no longer there (`mode="editar"`). */
  onGone?: () => void
  /** Called with whether something is typed and not saved. */
  onDirtyChange?: (dirty: boolean) => void
  /** Where the dialogs go; inline after the form when absent. */
  dialogHost?: HTMLElement | null
}

export default function StockEntryForm({
  mode,
  today,
  initial,
  entryId = '',
  preselectedVarietyId,
  preselectedOrigin,
  fixedVarietyId,
  fixedOrigin,
  onSaved,
  onDeleted,
  onGone,
  onDirtyChange,
  dialogHost,
}: StockEntryFormProps) {
  const queryClient = useQueryClient()
  const varietiesQuery = useQuery({
    queryKey: keys.varieties(),
    queryFn: () => get<Variety[]>('/varieties'),
  })
  const stockQuery = useQuery({ queryKey: keys.stock(), queryFn: readStock })

  const [date, setDate] = useState(initial?.date ?? today)
  const [grams, setGrams] = useState(initial !== undefined ? String(initial.grams) : '')
  const [varietyId, setVarietyId] = useState(
    initial !== undefined
      ? String(initial.variety_id)
      : fixedVarietyId !== undefined
        ? String(fixedVarietyId)
        : preselectedVarietyId !== undefined
          ? String(preselectedVarietyId)
          : '',
  )
  const [origin, setOrigin] = useState<Origin>(initial?.origin ?? fixedOrigin ?? preselectedOrigin ?? 'purchase')
  const [totalCost, setTotalCost] = useState(
    initial?.total_cost !== null && initial?.total_cost !== undefined ? String(initial.total_cost) : '',
  )
  const [note, setNote] = useState(initial?.note ?? '')
  const [formError, setFormError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [sending, setSending] = useState(false)
  const [confirmingSave, setConfirmingSave] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  // Something typed (or changed, on an edit) is what the host asks about before discarding.
  const dirty =
    grams !== (initial !== undefined ? String(initial.grams) : '') ||
    totalCost !== (initial?.total_cost != null ? String(initial.total_cost) : '') ||
    note !== (initial?.note ?? '')
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  // The entry is no longer there (deleted elsewhere, or never this business's).
  function entryIsGone(): void {
    invalidateResource(queryClient, 'stock', { refetchType: 'none' })
    onGone?.()
  }

  const previewGrams = parseSignedGrams(grams)
  const previewCost = parseMoney(totalCost)
  // A negative adjustment carries no cost (stock.md): the preview only ever shows for
  // positive grams, the only case `cost_per_gram` (and its front mirror) accepts.
  const preview =
    previewGrams.ok && previewCost.ok && Number(previewGrams.value) > 0
      ? costPerGram(previewCost.value, gramsToHundredths(previewGrams.value))
      : null

  const varietyGrams = (() => {
    const variety = Number(varietyId)
    if (varietyId === '' || !Number.isInteger(variety)) return null
    const found = stockQuery.data?.varieties.find((row) => row.variety_id === variety)
    return found?.grams ?? null
  })()

  function buildBody(): { date: string; variety_id: number; origin: Origin; grams: string; total_cost?: number; note?: string } | null {
    if (!previewGrams.ok) return null
    const variety = Number(varietyId)
    if (!Number.isInteger(variety) || varietyId === '') return null
    const parsedCost = totalCost.trim() === '' ? undefined : parseMoney(totalCost)
    if (parsedCost !== undefined && !parsedCost.ok) return null
    return {
      date,
      variety_id: variety,
      origin,
      grams: previewGrams.value,
      total_cost: parsedCost?.ok ? parsedCost.value : undefined,
      note: note.trim() === '' ? undefined : note.trim(),
    }
  }

  async function save(): Promise<void> {
    const body = buildBody()
    if (body === null) {
      setFormError(GENERIC_REFUSAL)
      return
    }
    setFormError(null)
    setOffline(false)
    setSending(true)
    try {
      if (mode === 'nuevo') {
        await recordEntry(body)
      } else {
        await editEntry(entryId, body)
      }
      // Marked stale without refetching: this screen is leaving, and its own entry's query
      // would otherwise refetch a record that may no longer be there.
      invalidateResource(queryClient, 'stock', { refetchType: 'none' })
      onSaved()
    } catch (caught) {
      if (caught instanceof ApiError && mode === 'editar' && isGone(caught.code)) {
        entryIsGone()
        return
      }
      if (caught instanceof ApiError) {
        const message = resolveOverride(FIELD_OVERRIDES, caught.code)
        setFormError(message ?? (caught.code !== UNKNOWN_CODE ? GENERIC_REFUSAL : ERROR_GENERICO_MENSAJE))
      } else if (caught instanceof NetworkError) {
        setOffline(true)
      } else {
        setFormError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSending(false)
      setConfirmingSave(false)
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (mode === 'editar') {
      setConfirmingSave(true)
      return
    }
    void save()
  }

  async function onConfirmDelete(): Promise<void> {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteEntry(entryId)
      invalidateResource(queryClient, 'stock', { refetchType: 'none' })
      onDeleted?.()
    } catch (caught) {
      setConfirmingDelete(false)
      if (caught instanceof ApiError && isGone(caught.code)) {
        entryIsGone()
        return
      }
      if (caught instanceof NetworkError) setOffline(true)
      else setDeleteError(ERROR_GENERICO_MENSAJE)
    } finally {
      setDeleting(false)
    }
  }

  const varietyName = (() => {
    const found = (varietiesQuery.data ?? []).find((variety) => String(variety.id) === varietyId)
    return found?.name ?? ''
  })()

  const dialogs = (
    <>
      {confirmingSave && (
        <ConfirmDialog
          title="¿Guardás los cambios?"
          detail="Esto actualiza la entrada."
          confirmText="Sí, guardar"
          cancelText="No, seguir editando"
          onConfirm={() => {
            if (!sending) void save()
          }}
          onCancel={() => setConfirmingSave(false)}
        />
      )}

      {confirmingDelete && initial !== undefined && (
        <ConfirmDialog
          title="Antes de borrar"
          detail={`¿Borrás la entrada del ${formatDate(initial.date, initial.date)} de ${varietyName}, ${formatGrams(initial.grams)}? Esto no se puede deshacer.`}
          confirmText="Sí, borrala"
          cancelText="No, dejala"
          onConfirm={() => {
            if (!deleting) void onConfirmDelete()
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
      {deleteError !== null && <ErrorGenerico />}
    </>
  )

  return (
    <>
      <form className="formulario" onSubmit={onSubmit}>
        <label className="campo">
          <span className="campo__rotulo">Fecha</span>
          <input
            className="campo__input"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </label>
        <label className="campo">
          <span className="campo__rotulo">Gramos</span>
          <input
            className="campo__input"
            inputMode="decimal"
            value={grams}
            onChange={(event) => setGrams(event.target.value)}
            required
          />
        </label>
        <label className="campo">
          <span className="campo__rotulo">Variedad</span>
          <select
            className="campo__input"
            value={varietyId}
            onChange={(event) => setVarietyId(event.target.value)}
            disabled={fixedVarietyId !== undefined}
            required
          >
            <option value="">Elegí una variedad</option>
            {(varietiesQuery.data ?? []).map((variety) => (
              <option key={variety.id} value={variety.id}>
                {variety.name}
              </option>
            ))}
          </select>
          {varietyGrams !== null && (
            <span className="campo__ayuda">Hoy tiene {formatGrams(varietyGrams)}</span>
          )}
        </label>
        {fixedOrigin === undefined && (
          <fieldset className="campo">
            <legend className="campo__rotulo">Origen</legend>
            <div className="origen-pildoras">
              {ORIGIN_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={origin === option.value ? 'pildora pildora--activa' : 'pildora'}
                  aria-pressed={origin === option.value}
                  onClick={() => setOrigin(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <label className="campo">
          <span className="campo__rotulo">Costo total</span>
          <input
            className="campo__input"
            inputMode="numeric"
            value={totalCost}
            onChange={(event) => setTotalCost(event.target.value)}
          />
          <span className="campo__ayuda">Obligatorio cuando es una compra</span>
        </label>
        <label className="campo">
          <span className="campo__rotulo">Nota</span>
          <input
            className="campo__input"
            value={note}
            maxLength={200}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        {formError !== null && (
          <span className="campo__error" role="alert">
            {formError}
          </span>
        )}
        {offline && <SinConexion />}
        {preview !== null && (
          <span className="pie">Te queda en {formatMoney(preview)} el gramo</span>
        )}
        <button className="boton" type="submit" disabled={sending}>
          {mode === 'nuevo' ? 'Guardá la entrada' : 'Guardar'}
        </button>
        {mode === 'editar' && (
          <button
            type="button"
            className="boton--enlace"
            onClick={() => setConfirmingDelete(true)}
          >
            Borrar entrada
          </button>
        )}
      </form>
      {dialogHost ? createPortal(dialogs, dialogHost) : dialogs}
    </>
  )
}
