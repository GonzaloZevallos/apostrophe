/**
 * `EntradaStock` (`stock.md`, "On screen"): records a new stock entry or edits one,
 * shared by `/mi-stock/nueva-entrada` and `/mi-stock/entradas/:id`, the way
 * `ClienteForm` shares add and edit. Editing confirms before saving; deleting confirms
 * through `ConfirmDialog`, naming the date, variety and grams (`stock.md`: "Antes de
 * borrar"). The cost-per-gram preview ("Te queda en $ 8.500 el gramo") is the one
 * figure the front computes before saving (`domain/costPerGram.ts`, the mirror of
 * `app/stock/domain/costing.cost_per_gram`); every other grams or money figure here is
 * either what was typed or, after saving, the API's own answer.
 */

import { type FormEvent, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError, NetworkError, UNKNOWN_CODE, get } from '../api/client'
import { invalidateResource, keys } from '../api/keys'
import { GONE_NOTICE, isGone, resolveOverride, type RefusalCode } from '../api/refusals'
import {
  type Origin,
  type StockEntry,
  deleteEntry,
  editEntry,
  getEntry,
  recordEntry,
} from '../api/stock'
import { costPerGram, gramsToHundredths } from '../domain/costPerGram'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import GoneScreen from '../components/GoneScreen'
import SinConexion from '../components/SinConexion'
import { formatDate } from '../format/dates'
import { formatGrams, formatMoney } from '../format/money'
import { parseGrams, parseMoney } from '../format/parse'
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

export default function EntradaStock({ mode }: Props) {
  const { id } = useParams<{ id: string }>()
  const entryId = id ?? ''

  const existing = useQuery({
    queryKey: keys.stockEntry(entryId),
    queryFn: () => getEntry(entryId),
    enabled: mode === 'editar',
  })

  if (mode === 'nuevo') return <EntradaStockBody mode="nuevo" entryId={entryId} />

  if (existing.isError) {
    if (existing.error instanceof ApiError && isGone(existing.error.code)) {
      return <GoneScreen label="Stock" to="/mi-stock" />
    }
    if (existing.error instanceof NetworkError) {
      return (
        <main className="pantalla">
          <div className="cuerpo">
            <SinConexion />
          </div>
        </main>
      )
    }
    return (
      <main className="pantalla">
        <div className="cuerpo">
          <ErrorGenerico />
        </div>
      </main>
    )
  }

  if (existing.data === undefined) return null

  return <EntradaStockBody mode="editar" entryId={entryId} initial={existing.data} />
}

interface BodyProps {
  mode: 'nuevo' | 'editar'
  entryId: string
  initial?: StockEntry
}

function EntradaStockBody({ mode, entryId, initial }: BodyProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const varietiesQuery = useQuery({
    queryKey: keys.varieties(),
    queryFn: () => get<Variety[]>('/varieties'),
  })

  const [date, setDate] = useState(initial?.date ?? '')
  const [grams, setGrams] = useState(initial !== undefined ? String(initial.grams) : '')
  const [varietyId, setVarietyId] = useState(initial !== undefined ? String(initial.variety_id) : '')
  const [origin, setOrigin] = useState<Origin>(initial?.origin ?? 'purchase')
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

  const previewGrams = parseGrams(grams)
  const previewCost = parseMoney(totalCost)
  const preview =
    previewGrams.ok && previewCost.ok
      ? costPerGram(previewCost.value, gramsToHundredths(previewGrams.value))
      : null

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
      invalidateResource(queryClient, 'stock')
      navigate('/mi-stock', { state: { toast: 'Entrada guardada' } })
    } catch (caught) {
      if (caught instanceof ApiError && mode === 'editar' && isGone(caught.code)) {
        invalidateResource(queryClient, 'stock')
        navigate('/mi-stock', { state: { notice: GONE_NOTICE } })
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
      invalidateResource(queryClient, 'stock')
      navigate('/mi-stock', { state: { toast: 'Entrada eliminada' } })
    } catch (caught) {
      setConfirmingDelete(false)
      if (caught instanceof ApiError && isGone(caught.code)) {
        invalidateResource(queryClient, 'stock')
        navigate('/mi-stock', { state: { notice: GONE_NOTICE } })
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

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div className="encabezado-fila">
          <Link to="/mi-stock">Volver</Link>
          <span className="encabezado__titulo">
            {mode === 'nuevo' ? 'Nueva entrada' : 'Editar entrada'}
          </span>
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
    </main>
  )
}
