/**
 * `StockEntryForm`: the body of `EntradaStock` (`stock.md`, "On screen") as a component of its
 * own, so another screen can host the same form under the same rules: date, variety with
 * "On hand today: N g", grams, origin, total cost with "Required for a purchase", note, the
 * cost-per-gram preview, the owner's refusals, the edit confirmation and the delete
 * confirmation, all through the owner's routes (`api/stock`). It owns no chrome and no
 * navigation: the host learns what happened through `onSaved`, `onDeleted`, `onGone` and
 * `onDirtyChange`. A `fixedVarietyId` with a `fixedOrigin` is the locked form (only a new
 * entry can be locked: the types say so): the variety is named, the origin is a static chip,
 * the date is `today` and implied, and only the grams and the optional total cost are asked.
 * A host that only wants a starting point passes the `preselected*` ones.
 * Its dialogs sit inline after the form, or in `dialogHost` when the host wants them
 * elsewhere in its own markup.
 */

import { type FormEvent, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError, UNKNOWN_CODE, get } from '../api/client'
import { invalidateResource, keys } from '../api/keys'
import { isGone, resolveOverride, type RefusalCode } from '../api/refusals'
import {
  type Origin,
  type StockEntry,
  deleteEntry,
  editEntry,
  readStock,
  recordEntry,
} from '../api/stock'
import { costPerGram, gramsToHundredths } from '../domain/costPerGram'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import SinConexion from '../components/SinConexion'
import { formatDate } from '../format/dates'
import { formatGrams, formatMoney } from '../format/money'
import { parseMoney, parseSignedGrams } from '../format/parse'
import type { Variety } from './Variedades'
import { varietiesByName } from './varieties/varietiesByName'
import Boton from '../components/Boton'
import { GENERIC_REFUSAL_MESSAGE as GENERIC_REFUSAL, SAVE } from '../copy/common'
import {
  BEFORE_DELETING,
  CHOOSE_VARIETY,
  COST_ON_NEGATIVE,
  COST_REQUIRED,
  COST_REQUIRED_HELP,
  DATE_IN_FUTURE,
  DELETE_ENTRY,
  FIELD_DATE,
  FIELD_GRAMS,
  FIELD_NOTE,
  FIELD_ORIGIN,
  FIELD_TOTAL_COST,
  FIELD_VARIETY,
  GRAMS_INVALID,
  NO_KEEP_EDITING,
  NO_KEEP_IT,
  OPENING_COST_HINT,
  ORIGIN_ADJUSTMENT,
  ORIGIN_HARVEST,
  ORIGIN_OPENING_STOCK,
  ORIGIN_PURCHASE,
  SAVE_CHANGES_TITLE,
  SAVE_ENTRY,
  SAVE_ENTRY_DETAIL,
  YES_DELETE_IT,
  YES_SAVE,
  deleteEntryQuestion,
  onHandHelp,
  perGramPreview,
} from '../copy/stock'

const ORIGIN_OPTIONS: { value: Origin; label: string }[] = [
  { value: 'purchase', label: ORIGIN_PURCHASE },
  { value: 'harvest', label: ORIGIN_HARVEST },
  { value: 'opening_stock', label: ORIGIN_OPENING_STOCK },
  { value: 'adjustment', label: ORIGIN_ADJUSTMENT },
]

const DEFAULT_ORIGIN_CODE: Origin = 'purchase'

const FIELD_OVERRIDES: Partial<Record<RefusalCode, string>> = {
  'stock.cost_required': COST_REQUIRED,
  'stock.cost_on_negative_adjustment': COST_ON_NEGATIVE,
  'stock.date_in_future': DATE_IN_FUTURE,
  'stock.grams_invalid': GRAMS_INVALID,
  'stock.cost_invalid': GENERIC_REFUSAL,
  'stock.note_too_long': GENERIC_REFUSAL,
}

interface CommonProps {
  today: string
  entryId?: string
  /** A starting choice the person can still change. */
  preselectedVarietyId?: number
  preselectedOrigin?: Origin
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

/** The owner's form: a new entry or an edit, nothing locked. */
interface OpenProps extends CommonProps {
  mode: 'nuevo' | 'editar'
  /** The entry being edited (`mode="editar"`). */
  initial?: StockEntry
  fixedVarietyId?: undefined
  fixedOrigin?: undefined
}

/** The locked form: only a new entry, with no starting entry, can lock its variety and origin. */
interface LockedProps extends CommonProps {
  mode: 'nuevo'
  initial?: undefined
  /** The variety is named, not chosen. */
  fixedVarietyId: number
  /** The origin is a static chip, not offered. */
  fixedOrigin: 'opening_stock'
}

export type StockEntryFormProps = OpenProps | LockedProps

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
  // An entry of an archived variety keeps it: editing may keep that variety but the picker
  // offers no other archived one. Its name comes from the archived list, asked only then.
  const listedVarieties = varietiesQuery.data
  const entryVarietyIsListed =
    initial === undefined || listedVarieties === undefined || listedVarieties.some((v) => v.id === initial.variety_id)
  const archivedQuery = useQuery({
    queryKey: keys.archivedVarieties(),
    queryFn: () => get<Variety[]>('/varieties?archived=true'),
    enabled: !entryVarietyIsListed,
  })
  const pickable = [
    ...(listedVarieties ?? []),
    ...(archivedQuery.data ?? []).filter((v) => v.id === initial?.variety_id),
  ]

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
  const [origin, setOrigin] = useState<Origin>(initial?.origin ?? fixedOrigin ?? preselectedOrigin ?? DEFAULT_ORIGIN_CODE)
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
    const found = pickable.find((variety) => String(variety.id) === varietyId)
    return found?.name ?? ''
  })()

  const dialogs = (
    <>
      {confirmingSave && (
        <ConfirmDialog
          title={SAVE_CHANGES_TITLE}
          detail={SAVE_ENTRY_DETAIL}
          confirmText={YES_SAVE}
          cancelText={NO_KEEP_EDITING}
          onConfirm={() => {
            if (!sending) void save()
          }}
          onCancel={() => setConfirmingSave(false)}
        />
      )}

      {confirmingDelete && initial !== undefined && (
        <ConfirmDialog
          title={BEFORE_DELETING}
          detail={deleteEntryQuestion(
            formatDate(initial.date, initial.date),
            varietyName,
            formatGrams(initial.grams),
          )}
          confirmText={YES_DELETE_IT}
          cancelText={NO_KEEP_IT}
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
        {fixedVarietyId !== undefined ? (
          <>
        <div className="campo">
          <span className="campo__rotulo">{FIELD_VARIETY}</span>
          <span className="campo__valor">{varietyName}</span>
          {varietyGrams !== null && (
            <span className="campo__ayuda" data-copy="help">{onHandHelp(formatGrams(varietyGrams))}</span>
          )}
        </div>
        <label className="campo">
          <span className="campo__rotulo">{FIELD_GRAMS}</span>
          <input
            className="campo__input"
            inputMode="decimal"
            value={grams}
            onChange={(event) => setGrams(event.target.value)}
            required
          />
        </label>
        <div className="campo">
          <div className="origen-pildoras">
            <span className="pildora pildora--activa pildora--fija">{ORIGIN_OPENING_STOCK}</span>
          </div>
        </div>
        <label className="campo">
          <span className="campo__rotulo">{FIELD_TOTAL_COST}</span>
          <input
            className="campo__input"
            inputMode="numeric"
            value={totalCost}
            onChange={(event) => setTotalCost(event.target.value)}
          />
          <span className="campo__ayuda" data-copy="help">{OPENING_COST_HINT}</span>
        </label>
          </>
        ) : (
          <>
            <label className="campo">
              <span className="campo__rotulo">{FIELD_DATE}</span>
              <input
                className="campo__input"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </label>
            <label className="campo">
              <span className="campo__rotulo">{FIELD_GRAMS}</span>
              <input
                className="campo__input"
                inputMode="decimal"
                value={grams}
                onChange={(event) => setGrams(event.target.value)}
                required
              />
            </label>
            <label className="campo">
              <span className="campo__rotulo">{FIELD_VARIETY}</span>
              <select
                className="campo__input"
                value={varietyId}
                onChange={(event) => setVarietyId(event.target.value)}
                disabled={fixedVarietyId !== undefined}
                required
              >
                <option value="">{CHOOSE_VARIETY}</option>
                {varietiesByName(pickable).map((variety) => (
                  <option key={variety.id} value={variety.id}>
                    {variety.name}
                  </option>
                ))}
              </select>
              {varietyGrams !== null && (
                <span className="campo__ayuda" data-copy="help">{onHandHelp(formatGrams(varietyGrams))}</span>
              )}
            </label>
            {fixedOrigin === undefined && (
              <fieldset className="campo">
                <legend className="campo__rotulo">{FIELD_ORIGIN}</legend>
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
              <span className="campo__rotulo">{FIELD_TOTAL_COST}</span>
              <input
                className="campo__input"
                inputMode="numeric"
                value={totalCost}
                onChange={(event) => setTotalCost(event.target.value)}
              />
              <span className="campo__ayuda" data-copy="help">{COST_REQUIRED_HELP}</span>
            </label>
            <label className="campo">
              <span className="campo__rotulo">{FIELD_NOTE}</span>
              <input
                className="campo__input"
                value={note}
                maxLength={200}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
          </>
        )}
        {formError !== null && (
          <span className="campo__error" role="alert">
            {formError}
          </span>
        )}
        {offline && <SinConexion />}
        {preview !== null && (
          <span className="pie" data-copy="help">{perGramPreview(formatMoney(preview))}</span>
        )}
        <Boton textOnly="submit" type="submit" disabled={sending}>
          {mode === 'nuevo' ? SAVE_ENTRY : SAVE}
        </Boton>
        {mode === 'editar' && (
          <Boton
            variant="icon"
            action="delete"
            ariaLabel={DELETE_ENTRY}
            onClick={() => setConfirmingDelete(true)}
          />
        )}
      </form>
      {dialogHost ? createPortal(dialogs, dialogHost) : dialogs}
    </>
  )
}
