/**
 * `EntradaStock` (`stock.md`, "On screen"): records a new stock entry or edits one,
 * shared by `/varieties/entries/new` and `/varieties/entries/:id`, the way
 * `ClienteForm` shares add and edit. It is a form ("Cerrar", no bar): Cerrar and a save go
 * back by history, or with none to Variedades (new) / "Todas las entradas" (edit), and leaving
 * with something typed asks first. `?variety={id}` chooses that variety, and "Stock inicial"
 * with it when `entriesOf` finds none for it. Editing confirms before saving; deleting confirms
 * through `ConfirmDialog`, naming the date, variety and grams (`stock.md`: "Antes de
 * borrar"). The cost-per-gram preview ("Te queda en $ 8.500 el gramo") is the one
 * figure the front computes before saving (`domain/costPerGram.ts`, the mirror of
 * `app/stock/domain/costing.cost_per_gram`); every other grams or money figure here is
 * either what was typed or, after saving, the API's own answer.
 */

import { type FormEvent, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useOutletContext, useParams, useSearchParams } from 'react-router'
import { ApiError, NetworkError, UNKNOWN_CODE, get } from '../api/client'
import { invalidateResource, keys } from '../api/keys'
import type { Me } from '../api/me'
import { isGone, resolveOverride, type RefusalCode } from '../api/refusals'
import {
  type Origin,
  type StockEntry,
  deleteEntry,
  editEntry,
  entriesOf,
  getEntry,
  readStock,
  recordEntry,
} from '../api/stock'
import { costPerGram, gramsToHundredths } from '../domain/costPerGram'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import GoneScreen from '../components/GoneScreen'
import SinConexion from '../components/SinConexion'
import Loading from '../components/Loading'
import { useBackOr } from '../components/useBackOr'
import { useLeaveGuard } from '../components/useLeaveGuard'
import { useFlash } from '../flash/useFlash'
import { formatDate } from '../format/dates'
import { formatGrams, formatMoney } from '../format/money'
import { parseMoney, parseSignedGrams } from '../format/parse'
import { STOCK, VARIETIES } from '../routes'
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

interface Props {
  mode: 'nuevo' | 'editar'
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="pantalla">
      <div className="cuerpo">{children}</div>
    </main>
  )
}

export default function EntradaStock({ mode }: Props) {
  const me = useOutletContext<Me>()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const entryId = id ?? ''
  const fromVariety = parseVarietyParam(searchParams.get('variety'))

  const existing = useQuery({
    queryKey: keys.stockEntry(entryId),
    queryFn: () => getEntry(entryId),
    enabled: mode === 'editar',
  })
  // The preselection needs to know whether the variety has entries: the form waits for it.
  const stockQuery = useQuery({
    queryKey: keys.stock(),
    queryFn: readStock,
    enabled: mode === 'nuevo' && fromVariety !== null,
  })

  if (mode === 'nuevo') {
    if (fromVariety === null) return <EntradaStockBody mode="nuevo" entryId={entryId} today={me.today} />
    if (stockQuery.isError) return <Frame>{errorOf(stockQuery.error)}</Frame>
    if (stockQuery.data === undefined) {
      return (
        <Frame>
          <Loading />
        </Frame>
      )
    }
    return (
      <EntradaStockBody
        mode="nuevo"
        entryId={entryId}
        today={me.today}
        chosenVariety={fromVariety}
        hasEntries={entriesOf(stockQuery.data, fromVariety).length > 0}
      />
    )
  }

  if (existing.isError) {
    if (existing.error instanceof ApiError && isGone(existing.error.code)) {
      return <GoneScreen label="Variedades" to={VARIETIES} />
    }
    return <Frame>{errorOf(existing.error)}</Frame>
  }

  if (existing.data === undefined) {
    return (
      <Frame>
        <Loading />
      </Frame>
    )
  }

  return <EntradaStockBody mode="editar" entryId={entryId} today={me.today} initial={existing.data} />
}

function parseVarietyParam(raw: string | null): number | null {
  if (raw === null || !/^[0-9]+$/.test(raw)) return null
  const value = Number(raw)
  return Number.isSafeInteger(value) ? value : null
}

function errorOf(error: unknown) {
  return error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />
}

interface BodyProps {
  mode: 'nuevo' | 'editar'
  entryId: string
  today: string
  initial?: StockEntry
  chosenVariety?: number
  hasEntries?: boolean
}

function EntradaStockBody({ mode, entryId, today, initial, chosenVariety, hasEntries }: BodyProps) {
  const queryClient = useQueryClient()
  const flash = useFlash()
  const back = useBackOr(mode === 'nuevo' ? VARIETIES : STOCK)

  const varietiesQuery = useQuery({
    queryKey: keys.varieties(),
    queryFn: () => get<Variety[]>('/varieties'),
  })
  const stockQuery = useQuery({ queryKey: keys.stock(), queryFn: readStock })

  const [date, setDate] = useState(initial?.date ?? today)
  const [grams, setGrams] = useState(initial !== undefined ? String(initial.grams) : '')
  const [varietyId, setVarietyId] = useState(
    initial !== undefined ? String(initial.variety_id) : chosenVariety !== undefined ? String(chosenVariety) : '',
  )
  const [origin, setOrigin] = useState<Origin>(
    initial?.origin ?? (chosenVariety !== undefined && hasEntries === false ? 'opening_stock' : 'purchase'),
  )
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
  const [gone, setGone] = useState(false)

  // Something typed (or changed, on an edit) is what "Cerrar" asks about before discarding.
  const dirty =
    grams !== (initial !== undefined ? String(initial.grams) : '') ||
    totalCost !== (initial?.total_cost != null ? String(initial.total_cost) : '') ||
    note !== (initial?.note ?? '')
  const { blocker, disarm } = useLeaveGuard(dirty)

  function leave(toast: 'Entrada guardada' | 'Entrada eliminada'): void {
    disarm()
    flash.armAfterLeaving(toast)
    back()
  }

  // The entry is no longer there (deleted elsewhere, or never this business's).
  function entryIsGone(): void {
    invalidateResource(queryClient, 'stock', { refetchType: 'none' })
    setGone(true)
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
      leave('Entrada guardada')
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
      leave('Entrada eliminada')
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

  if (gone) return <GoneScreen label="Variedades" to={VARIETIES} />

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div className="gasto-form__cabecera">
          <span className="gasto-form__titulo">
            {mode === 'nuevo' ? 'Nueva entrada' : 'Editar entrada'}
          </span>
          <button type="button" className="boton--enlace gasto-form__cerrar" onClick={back}>
            Cerrar
          </button>
        </div>
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
      </div>

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
      {blocker.state === 'blocked' && (
        <ConfirmDialog
          title={mode === 'nuevo' ? '¿Descartás la entrada?' : '¿Descartás los cambios?'}
          detail="Se pierde lo que cargaste: todavía no se guardó nada."
          confirmText="Sí, descartalo"
          cancelText="No, seguí cargando"
          onConfirm={() => blocker.proceed()}
          onCancel={() => blocker.reset()}
        />
      )}
    </main>
  )
}
