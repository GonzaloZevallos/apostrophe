/**
 * `PriceForm` (`PrecioNuevo.dc.html`): a new price entry for a variety
 * (`POST /varieties/{id}/prices`). It knows nothing of the router: its host supplies the
 * exits and learns whether something was typed. A refusal shows under the field it is
 * about and keeps what was typed. A price has one code for several rules, so the code
 * alone picks the field: a repeated date under "Rige desde", a rule of the amounts under
 * "Precio de lista", a grams refusal under "Mínimo en gramos".
 */

import { type FormEvent, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError, UNKNOWN_CODE, post } from '../../api/client'
import { invalidateResource } from '../../api/keys'
import type { PricingSettings } from '../../api/pricingSettings'
import {
  isGone,
  kindOf,
  VARIETY_REFUSAL_TEXT,
  type RefusalCode,
} from '../../api/refusals'
import type { SuccessToast } from '../../components/AvisoExito'
import { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import SinConexion from '../../components/SinConexion'
import { parseGrams, parseMoney } from '../../format/parse'
import { GENERIC_REFUSAL_MESSAGE } from '../Variedades'
import { GRAMS_INVALID_MESSAGE } from '../stockMessages'
import { PRICE_DISCOUNT_HELP, PRICE_FROM_GRAMS_HELP, PRICE_PER_GRAM_HELP, PRICE_SAVED } from './priceMessages'
import Boton from '../../components/Boton'

export const DUPLICATE_DATE_MESSAGE = 'Ya cargaste un precio con esa fecha'
export const PRICE_INVALID_MESSAGE = 'Revisá los precios cargados'

type Field = 'effectiveFrom' | 'listPrice' | 'bulkPrice' | 'bulkMinimum' | 'vipPrice' | 'form'
type Errors = Partial<Record<Field, string>>

const FIELD_OF_CODE: Partial<Record<RefusalCode, { field: Field; message: string }>> = {
  'variety.duplicate_effective_date': { field: 'effectiveFrom', message: DUPLICATE_DATE_MESSAGE },
  'variety.price_entry_invalid': { field: 'listPrice', message: PRICE_INVALID_MESSAGE },
  'grams.invalid': { field: 'bulkMinimum', message: GRAMS_INVALID_MESSAGE },
  'variety.vip_price_not_below_list': {
    field: 'vipPrice',
    message: VARIETY_REFUSAL_TEXT['variety.vip_price_not_below_list'] ?? PRICE_INVALID_MESSAGE,
  },
}

function fieldOfCode(code: string): { field: Field; message: string } | undefined {
  return (FIELD_OF_CODE as Record<string, { field: Field; message: string } | undefined>)[code]
}

export interface PriceFormProps {
  varietyId: number
  today: string
  /** The switches in force: a rule that is off has no field and nothing about it is sent. */
  settings: PricingSettings
  onDone: (saved: SuccessToast) => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
  onGone: () => void
  /** A host with its own frame and its own "Cerrar" (the Onboarding) leaves the title row out
   * and keeps the price effective today: no "Rige desde" to change. */
  bare?: boolean
}

function FieldError({ message }: { message: string | undefined }) {
  if (message === undefined) return null
  return (
    <span className="campo__error" role="alert">
      {message}
    </span>
  )
}

export default function PriceForm({
  varietyId,
  today,
  settings,
  onDone,
  onCancel,
  onDirtyChange,
  onGone,
  bare = false,
}: PriceFormProps) {
  const queryClient = useQueryClient()
  const [effectiveFrom, setEffectiveFrom] = useState(today)
  const [listPrice, setListPrice] = useState('')
  const [bulkPrice, setBulkPrice] = useState('')
  const [bulkMinimum, setBulkMinimum] = useState('')
  const [vipPrice, setVipPrice] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [offline, setOffline] = useState(false)
  const [sending, setSending] = useState(false)

  const dirty = effectiveFrom !== today || listPrice !== '' || bulkPrice !== '' || bulkMinimum !== '' || vipPrice !== ''
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setOffline(false)
    const money = parseMoney(listPrice)
    const hasBulk = settings.is_bulk_pricing && (bulkPrice.trim() !== '' || bulkMinimum.trim() !== '')
    const hasVip = settings.is_vip_customers && vipPrice.trim() !== ''
    const vipMoney = parseMoney(vipPrice)
    const bulkMoney = parseMoney(bulkPrice)
    const bulkGrams = parseGrams(bulkMinimum)
    const found: Errors = {}
    if (!money.ok) found.listPrice = PRICE_INVALID_MESSAGE
    if (hasBulk && !bulkMoney.ok) found.bulkPrice = PRICE_INVALID_MESSAGE
    if (hasBulk && !bulkGrams.ok) found.bulkMinimum = GRAMS_INVALID_MESSAGE
    if (hasVip && !vipMoney.ok) found.vipPrice = PRICE_INVALID_MESSAGE
    setErrors(found)
    if (!money.ok || (hasBulk && (!bulkMoney.ok || !bulkGrams.ok)) || (hasVip && !vipMoney.ok)) return
    setSending(true)
    try {
      await post(`/varieties/${varietyId}/prices`, {
        effective_from: effectiveFrom,
        list_price: money.value,
        bulk_price: hasBulk && bulkMoney.ok ? bulkMoney.value : undefined,
        bulk_minimum: hasBulk && bulkGrams.ok ? bulkGrams.value : undefined,
        vip_price: hasVip && vipMoney.ok ? vipMoney.value : undefined,
      })
      invalidateResource(queryClient, 'varieties')
      onDone(PRICE_SAVED)
    } catch (caught) {
      if (caught instanceof ApiError && isGone(caught.code)) {
        invalidateResource(queryClient, 'varieties')
        onGone()
      } else if (caught instanceof ApiError) {
        const mapped = fieldOfCode(caught.code)
        if (mapped !== undefined) setErrors({ [mapped.field]: mapped.message })
        else if (caught.code !== UNKNOWN_CODE && kindOf(caught.code) === 'refusal') {
          setErrors({ form: GENERIC_REFUSAL_MESSAGE })
        } else setErrors({ form: ERROR_GENERICO_MENSAJE })
      } else if (caught instanceof NetworkError) {
        setOffline(true)
      } else {
        setErrors({ form: ERROR_GENERICO_MENSAJE })
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="gasto-form">
      {!bare && (
        <div className="gasto-form__cabecera">
          <span className="gasto-form__titulo">Nuevo precio</span>
          <span className="gasto-form__cerrar">
            <Boton variant="icon" action="close" ariaLabel="Cerrar" onClick={onCancel} />
          </span>
        </div>
      )}
      <form className="formulario" onSubmit={onSubmit}>
        {bare ? (
          <FieldError message={errors.effectiveFrom} />
        ) : (
          <label className="campo">
            <span className="campo__rotulo">Rige desde</span>
            <input
              className="campo__input"
              type="date"
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
              required
            />
            <FieldError message={errors.effectiveFrom} />
          </label>
        )}
        <label className="campo">
          <span className="campo__rotulo">Precio de lista</span>
          <input
            className="campo__input campo__input--monto"
            inputMode="numeric"
            value={listPrice}
            onChange={(event) => setListPrice(event.target.value)}
            required
          />
          <span className="campo__ayuda" data-copy="help">{PRICE_PER_GRAM_HELP}</span>
          <FieldError message={errors.listPrice} />
        </label>
        {settings.is_bulk_pricing && (
          <>
          <label className="campo">
            <span className="campo__rotulo">Precio por cantidad</span>
            <input
              className="campo__input"
              inputMode="numeric"
              value={bulkPrice}
              onChange={(event) => setBulkPrice(event.target.value)}
            />
            <span className="campo__ayuda" data-copy="help">{PRICE_DISCOUNT_HELP}</span>
            <FieldError message={errors.bulkPrice} />
          </label>
          <label className="campo">
            <span className="campo__rotulo">Mínimo en gramos</span>
            <input
              className="campo__input"
              inputMode="decimal"
              value={bulkMinimum}
              onChange={(event) => setBulkMinimum(event.target.value)}
            />
            <span className="campo__ayuda" data-copy="help">{PRICE_FROM_GRAMS_HELP}</span>
            <FieldError message={errors.bulkMinimum} />
          </label>
          </>
        )}
        {settings.is_vip_customers && (
          <label className="campo">
            <span className="campo__rotulo">Precio VIP</span>
            <input
              className="campo__input"
              inputMode="numeric"
              value={vipPrice}
              onChange={(event) => setVipPrice(event.target.value)}
            />
            <span className="campo__ayuda" data-copy="help">{PRICE_DISCOUNT_HELP}</span>
            <FieldError message={errors.vipPrice} />
          </label>
        )}
        <FieldError message={errors.form} />
        {offline && <SinConexion />}
        <Boton textOnly="submit" type="submit" disabled={sending}>
          Guardá el precio
        </Boton>
      </form>
    </div>
  )
}
