/**
 * `VariedadDetalle` (`varieties.md`, "On screen"): the price history with "Rige
 * desde", a new price entry, renaming, and deleting an entry through "Antes de
 * borrar" (ADR-0003) — worded by `priceDeleteNotice.ts` from the history alone, never
 * from "today". A variety that is gone (`variety.not_found`, kind `gone`) shows the
 * plain gone-detail state, never the generic retry (plan, "Gone records").
 */

import { type FormEvent, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useOutletContext, useParams } from 'react-router'
import { ApiError, NetworkError, del, get, patch, post } from '../api/client'
import { invalidateResource, keys } from '../api/keys'
import type { Me } from '../api/me'
import { GONE_DETAIL, isGone, kindOf, resolveOverride, type RefusalCode } from '../api/refusals'
import AvisoExito, { type SuccessToast } from '../components/AvisoExito'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../components/ErrorGenerico'
import GoneNotice from '../components/GoneNotice'
import SinConexion from '../components/SinConexion'
import { formatDateShort, sinceWhen } from '../format/dates'
import { formatGrams, formatMoney } from '../format/money'
import { parseGrams, parseMoney } from '../format/parse'
import { deleteNotice, type HistoryEntry } from './priceDeleteNotice'
import {
  NAME_INVALID_MESSAGE,
  NAME_TAKEN_MESSAGE,
  NO_PRICE_TODAY,
  VARIETY_SAVED,
  type Variety,
} from './Variedades'

export const PRICE_SAVED = 'Precio guardado'
export const PRICE_DELETED = 'Precio eliminado'
export const DUPLICATE_DATE_MESSAGE = 'Ya cargaste un precio con esa fecha'
export const PRICE_INVALID_MESSAGE = 'Revisá los precios cargados'
export const GENERIC_REFUSAL_MESSAGE = 'Revisá los datos e intentá de nuevo.'

interface FullHistoryEntry extends HistoryEntry {
  bulk_price: number | null
  bulk_minimum: number | null
}

const RENAME_OVERRIDES: Partial<Record<RefusalCode, string>> = {
  'variety.name_taken': NAME_TAKEN_MESSAGE,
  'variety.name_invalid': NAME_INVALID_MESSAGE,
}

const PRICE_OVERRIDES: Partial<Record<RefusalCode, string>> = {
  'variety.duplicate_effective_date': DUPLICATE_DATE_MESSAGE,
  'variety.price_entry_invalid': PRICE_INVALID_MESSAGE,
  'grams.invalid': PRICE_INVALID_MESSAGE,
}

export default function VariedadDetalle() {
  const { id } = useParams<{ id: string }>()
  const variedadId = id ?? ''
  const me = useOutletContext<Me>()
  const queryClient = useQueryClient()

  const varietyQuery = useQuery({
    queryKey: keys.variety(variedadId),
    queryFn: () => get<Variety>(`/varieties/${variedadId}`),
  })
  const historyQuery = useQuery({
    queryKey: keys.varietyPrices(variedadId),
    queryFn: () => get<FullHistoryEntry[]>(`/varieties/${variedadId}/prices`),
  })

  const [toast, setToast] = useState<SuccessToast | null>(null)
  const [gone, setGone] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)
  const [deleteOffline, setDeleteOffline] = useState(false)

  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [renameOffline, setRenameOffline] = useState(false)
  const [savingRename, setSavingRename] = useState(false)

  const [addingPrice, setAddingPrice] = useState(false)
  const [effectiveFrom, setEffectiveFrom] = useState(me.today)
  const [listPrice, setListPrice] = useState('')
  const [bulkPrice, setBulkPrice] = useState('')
  const [bulkMinimum, setBulkMinimum] = useState('')
  const [priceError, setPriceError] = useState<string | null>(null)
  const [priceOffline, setPriceOffline] = useState(false)
  const [savingPrice, setSavingPrice] = useState(false)

  const [deletingEntry, setDeletingEntry] = useState<FullHistoryEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (toast === null) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!gone) return
    const timer = setTimeout(() => setGone(false), 4000)
    return () => clearTimeout(timer)
  }, [gone])

  function refresh(): void {
    invalidateResource(queryClient, 'varieties')
  }

  function goneSomewhere(): boolean {
    return (
      (varietyQuery.isError && varietyQuery.error instanceof ApiError && isGone(varietyQuery.error.code)) ||
      false
    )
  }

  async function onRename(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setRenameError(null)
    setRenameOffline(false)
    setSavingRename(true)
    try {
      await patch<Variety>(`/varieties/${variedadId}`, { name })
      refresh()
      setRenaming(false)
      setToast(VARIETY_SAVED)
    } catch (caught) {
      if (caught instanceof ApiError && isGone(caught.code)) {
        setRenaming(false)
        refresh()
        setGone(true)
      } else if (caught instanceof ApiError) {
        const message = resolveOverride(RENAME_OVERRIDES, caught.code)
        if (message !== undefined) setRenameError(message)
        else if (caught.code !== 'unknown' && kindOf(caught.code) === 'refusal') {
          setRenameError(GENERIC_REFUSAL_MESSAGE)
        } else {
          setRenameError(ERROR_GENERICO_MENSAJE)
        }
      } else if (caught instanceof NetworkError) {
        setRenameOffline(true)
      } else {
        setRenameError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSavingRename(false)
    }
  }

  async function onAddPrice(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setPriceError(null)
    setPriceOffline(false)
    const money = parseMoney(listPrice)
    if (!money.ok) {
      setPriceError(PRICE_INVALID_MESSAGE)
      return
    }
    let bulk: { bulk_price: number; bulk_minimum: string } | undefined
    if (bulkPrice.trim() !== '' || bulkMinimum.trim() !== '') {
      const bulkMoney = parseMoney(bulkPrice)
      const grams = parseGrams(bulkMinimum)
      if (!bulkMoney.ok || !grams.ok) {
        setPriceError(PRICE_INVALID_MESSAGE)
        return
      }
      bulk = { bulk_price: bulkMoney.value, bulk_minimum: grams.value }
    }
    setSavingPrice(true)
    try {
      await post(`/varieties/${variedadId}/prices`, {
        effective_from: effectiveFrom,
        list_price: money.value,
        bulk_price: bulk?.bulk_price,
        bulk_minimum: bulk?.bulk_minimum,
      })
      refresh()
      setAddingPrice(false)
      setListPrice('')
      setBulkPrice('')
      setBulkMinimum('')
      setToast(PRICE_SAVED)
    } catch (caught) {
      if (caught instanceof ApiError && isGone(caught.code)) {
        setAddingPrice(false)
        refresh()
        setGone(true)
      } else if (caught instanceof ApiError) {
        const message = resolveOverride(PRICE_OVERRIDES, caught.code)
        if (message !== undefined) setPriceError(message)
        else if (caught.code !== 'unknown' && kindOf(caught.code) === 'refusal') {
          setPriceError(GENERIC_REFUSAL_MESSAGE)
        } else {
          setPriceError(ERROR_GENERICO_MENSAJE)
        }
      } else if (caught instanceof NetworkError) {
        setPriceOffline(true)
      } else {
        setPriceError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSavingPrice(false)
    }
  }

  async function onConfirmDelete(): Promise<void> {
    if (deletingEntry === null) return
    setDeleting(true)
    try {
      await del(`/varieties/${variedadId}/prices/${deletingEntry.id}`)
      refresh()
      setDeletingEntry(null)
      setToast(PRICE_DELETED)
    } catch (caught) {
      setDeletingEntry(null)
      if (caught instanceof ApiError && isGone(caught.code)) {
        refresh()
        setGone(true)
      } else if (caught instanceof NetworkError) {
        setDeleteOffline(true)
      } else {
        setDeleteFailed(true)
      }
    } finally {
      setDeleting(false)
    }
  }

  if (varietyQuery.isError) {
    if (varietyQuery.error instanceof NetworkError) {
      return (
        <main className="pantalla">
          <div className="cuerpo">
            <SinConexion />
          </div>
        </main>
      )
    }
    if (goneSomewhere()) {
      return (
        <main className="pantalla">
          <div className="cuerpo">
            <div className="estado-vacio">
              <span className="estado-vacio__titulo">{GONE_DETAIL}</span>
              <Link to="/variedades" className="boton">
                Volver a Variedades
              </Link>
            </div>
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

  const variety = varietyQuery.data
  const history = historyQuery.data ?? []

  return (
    <main className="pantalla">
      <div className="cuerpo">
        {gone && <GoneNotice />}
        {deleteFailed && <ErrorGenerico />}
        {deleteOffline && <SinConexion />}
        {toast !== null && <AvisoExito texto={toast} />}
        <div className="encabezado-fila">
          <span className="encabezado__titulo">{variety?.name ?? ''}</span>
          {variety !== undefined && !renaming && (
            <button
              type="button"
              className="boton-enlace"
              onClick={() => {
                setName(variety.name)
                setRenameError(null)
                setRenaming(true)
              }}
            >
              Editar
            </button>
          )}
        </div>

        {renaming && (
          <form className="formulario" onSubmit={onRename}>
            <label className="campo">
              <span className="campo__rotulo">Nombre</span>
              <input
                className="campo__input"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
              {renameError !== null && (
                <span className="campo__error" role="alert">
                  {renameError}
                </span>
              )}
            </label>
            {renameOffline && <SinConexion />}
            <button className="boton" type="submit" disabled={savingRename}>
              Guardar
            </button>
          </form>
        )}

        {variety?.current_price === null && (
          <span className="variedad-item__sin-precio">{NO_PRICE_TODAY}</span>
        )}
        {variety?.current_price != null && (
          <div>
            <span className="campo__rotulo">
              Rige {sinceWhen(variety.current_price.effective_from, me.today)}
            </span>
            <div className="variedad-item__precios">
              <span className="precio-panel">
                <span className="precio-panel__rotulo">Lista</span>
                <span className="precio-panel__valor">{formatMoney(variety.current_price.list_price)}</span>
              </span>
              {variety.current_price.bulk_price !== null && variety.current_price.bulk_minimum !== null && (
                <span className="precio-panel">
                  <span className="precio-panel__rotulo">
                    Desde {formatGrams(variety.current_price.bulk_minimum)}
                  </span>
                  <span className="precio-panel__valor">{formatMoney(variety.current_price.bulk_price)}</span>
                </span>
              )}
            </div>
          </div>
        )}

        <button type="button" className="boton boton--suave" onClick={() => setAddingPrice(true)}>
          Nuevo precio
        </button>

        {addingPrice && (
          <form className="formulario" onSubmit={onAddPrice}>
            <label className="campo">
              <span className="campo__rotulo">Rige desde</span>
              <input
                className="campo__input"
                type="date"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
                required
              />
            </label>
            <label className="campo">
              <span className="campo__rotulo">Precio de lista</span>
              <input
                className="campo__input"
                type="text"
                inputMode="numeric"
                value={listPrice}
                onChange={(event) => setListPrice(event.target.value)}
                required
              />
            </label>
            <label className="campo">
              <span className="campo__rotulo">Precio por mayor</span>
              <input
                className="campo__input"
                type="text"
                inputMode="numeric"
                value={bulkPrice}
                onChange={(event) => setBulkPrice(event.target.value)}
              />
            </label>
            <label className="campo">
              <span className="campo__rotulo">Mínimo por mayor (g)</span>
              <input
                className="campo__input"
                type="text"
                inputMode="decimal"
                value={bulkMinimum}
                onChange={(event) => setBulkMinimum(event.target.value)}
              />
            </label>
            {priceError !== null && (
              <span className="campo__error" role="alert">
                {priceError}
              </span>
            )}
            {priceOffline && <SinConexion />}
            <button className="boton" type="submit" disabled={savingPrice}>
              Guardar precio
            </button>
          </form>
        )}

        <span className="campo__rotulo">Historial</span>
        <div className="historial">
          {history.map((entry) => (
            <div key={entry.id} className="historial-fila">
              <span className="historial-fila__fecha">
                Rige desde {formatDateShort(entry.effective_from)}
                {variety?.current_price?.id === entry.id && (
                  <span className="historial-fila__vigente">Vigente hoy</span>
                )}
              </span>
              <span className="historial-fila__precio">{formatMoney(entry.list_price)}</span>
              <button
                type="button"
                className="historial-fila__borrar"
                aria-label="Borrar este precio"
                onClick={() => setDeletingEntry(entry)}
              >
                Borrar
              </button>
            </div>
          ))}
        </div>
      </div>

      {deletingEntry !== null && (
        <ConfirmDialog
          title={`¿Borrás el precio desde el ${formatDateShort(deletingEntry.effective_from)}?`}
          detail={deleteNotice(history, deletingEntry.id)}
          confirmText="Sí, borrala"
          cancelText="No, dejala"
          onConfirm={() => {
            if (!deleting) void onConfirmDelete()
          }}
          onCancel={() => setDeletingEntry(null)}
        />
      )}
    </main>
  )
}
