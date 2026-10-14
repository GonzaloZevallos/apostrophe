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
import { isGone, kindOf } from '../../api/refusals'
import type { SuccessToast } from '../../components/AvisoExito'
import { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import SinConexion from '../../components/SinConexion'
import { parseGrams, parseMoney } from '../../format/parse'
import { GENERIC_REFUSAL_MESSAGE } from '../Variedades'
import Boton from '../../components/Boton'
import PriceFields, { FieldError } from './PriceFields'
import {
  GRAMS_INVALID_MESSAGE,
  PRICE_INVALID_MESSAGE,
  fieldOfCode,
  type PriceErrors,
  type PriceValues,
} from './priceFieldRules'

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
  const [values, setValues] = useState<PriceValues>({
    listPrice: '',
    bulkPrice: '',
    bulkMinimum: '',
    vipPrice: '',
  })
  const { listPrice, bulkPrice, bulkMinimum, vipPrice } = values
  const [errors, setErrors] = useState<PriceErrors>({})
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
    const found: PriceErrors = {}
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
      onDone('Precio guardado')
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
        <PriceFields
          settings={settings}
          values={values}
          errors={errors}
          onChange={(field, value) => setValues((current) => ({ ...current, [field]: value }))}
        />
        <FieldError message={errors.form} />
        {offline && <SinConexion />}
        <Boton textOnly="submit" type="submit" disabled={sending}>
          Guardá el precio
        </Boton>
      </form>
    </div>
  )
}
