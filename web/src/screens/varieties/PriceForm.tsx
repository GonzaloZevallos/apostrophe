/**
 * `PriceForm` (`PrecioNuevo.dc.html`): a new price entry for a variety
 * (`POST /api/products/{id}/prices`). It knows nothing of the router: its host supplies the
 * exits and learns whether something was typed. A refusal shows under the field it is
 * about and keeps what was typed. A price has one code for several rules, so the code
 * alone picks the field: a repeated date under "Rige desde", a rule of the amounts under
 * "Precio de lista", a grams refusal under "Mínimo en gramos".
 */

import { useTranslation } from 'react-i18next'
import { messageText } from '../../i18n/refusalKeys'
import { type FormEvent, type Ref, useEffect, useId, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError, UNKNOWN_CODE, post } from '../../api/client'
import { invalidateResource } from '../../api/keys'
import type { PricingSettings } from '../../api/pricingSettings'
import { chipDate } from '../../format/dates'
import { exceedsDecimals, useDecimalsSentence } from '../../format/unitDecimals'
import { isGone, kindOf } from '../../api/refusals'
import type { SuccessToast } from '../../components/AvisoExito'
import { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import { SheetActions } from '../../components/Sheet'
import SinConexion from '../../components/SinConexion'
import { GENERIC_REFUSAL_MESSAGE } from '../Variedades'
import Boton from '../../components/Boton'
import PriceFields, { FieldError } from './PriceFields'
import { PRICE_SAVED, VARIETIES_TEXT } from '../../copy/varieties'
import {
  fieldOfCode,
  readPriceValues,
  type PriceErrors,
  type PriceValues,
} from './priceFieldRules'
import { COMMON_TEXT } from '../../copy/common'

export interface PriceFormProps {
  varietyId: number
  /** How many decimals the product's unit allows (the bulk minimum is checked against it). */
  decimals: number
  today: string
  /** The switches in force: a rule that is off has no field and nothing about it is sent. */
  settings: PricingSettings
  onDone: (saved: SuccessToast) => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
  onGone: () => void
  /** Told whether the save is in flight, so the host can hold every way out meanwhile. */
  onSendingChange: (sending: boolean) => void
  /** The id and ref of the title: the host names its dialog by it and puts focus on it. */
  titleId: string
  titleRef: Ref<HTMLSpanElement>
}

export default function PriceForm({
  varietyId,
  decimals,
  today,
  settings,
  onDone,
  onCancel,
  onDirtyChange,
  onGone,
  onSendingChange,
  titleId,
  titleRef,
}: PriceFormProps) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const sentence = useDecimalsSentence()
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
  // The date choice starts closed at every open and is mounted only while open.
  const [choosingDate, setChoosingDate] = useState(false)
  const captionId = useId()
  const choiceId = useId()

  const dirty = effectiveFrom !== today || listPrice !== '' || bulkPrice !== '' || bulkMinimum !== '' || vipPrice !== ''
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    onSendingChange(sending)
  }, [sending, onSendingChange])

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setOffline(false)
    const read = readPriceValues(values, settings)
    const tooFine = settings.is_bulk_pricing && exceedsDecimals(bulkMinimum, decimals)
    if (tooFine || !read.ok) {
      setErrors({ ...(read.ok ? {} : read.errors), ...(tooFine ? { bulkMinimum: sentence(decimals) } : {}) })
      return
    }
    setErrors({})
    setSending(true)
    try {
      await post(`/api/products/${varietyId}/prices`, {
        effective_from: effectiveFrom,
        ...read.amounts,
      })
      invalidateResource(queryClient, 'varieties')
      onDone(PRICE_SAVED)
    } catch (caught) {
      if (caught instanceof ApiError && isGone(caught.code)) {
        invalidateResource(queryClient, 'varieties')
        onGone()
      } else if (caught instanceof ApiError) {
        const mapped = fieldOfCode(caught.code)
        if (caught.code === 'quantity.too_many_decimals') setErrors({ form: t('units:quantityRefused') })
        else if (mapped !== undefined) setErrors({ [mapped.field]: messageText(t, mapped.message) })
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
      <div className="gasto-form__cabecera">
        <span id={titleId} ref={titleRef} tabIndex={-1} className="gasto-form__titulo">
          {COMMON_TEXT.newPrice}
        </span>
        <span className="gasto-form__cerrar">
          <Boton variant="icon" action="close" ariaLabel={COMMON_TEXT.close} disabled={sending} onClick={onCancel} />
        </span>
      </div>
      <form className="formulario" onSubmit={onSubmit}>
        <div className="campo">
          <span id={captionId} className="campo__rotulo">{VARIETIES_TEXT.rigeDesde}</span>
          <span className="precio-chip">
            <Boton
              variant="secondary"
              icon="calendario"
              ariaDescribedBy={captionId}
              ariaExpanded={choosingDate}
              ariaControls={choiceId}
              onClick={() => setChoosingDate((open) => !open)}
            >
              {chipDate(effectiveFrom, today, t)}
            </Boton>
          </span>
          {choosingDate && (
            <div id={choiceId} className="precio-fecha">
              <Boton
                variant="link"
                onClick={() => {
                  setEffectiveFrom(today)
                  setChoosingDate(false)
                }}
              >
                {COMMON_TEXT.today}
              </Boton>
              <label className="precio-fecha__campo">
                <span className="campo__rotulo">{VARIETIES_TEXT.rigeDesde}</span>
                <input
                  className="campo__input"
                  type="date"
                  value={effectiveFrom}
                  onChange={(event) => {
                    setEffectiveFrom(event.target.value)
                    setChoosingDate(false)
                  }}
                  required
                />
              </label>
            </div>
          )}
          <FieldError message={errors.effectiveFrom} />
        </div>
        <PriceFields
          settings={settings}
          values={values}
          errors={errors}
          onChange={(field, value) => setValues((current) => ({ ...current, [field]: value }))}
        />
        <SheetActions>
          <FieldError message={errors.form} />
          {offline && <SinConexion />}
          <Boton textOnly="submit" type="submit" disabled={sending}>
            {VARIETIES_TEXT.guardaElPrecio}
          </Boton>
        </SheetActions>
      </form>
    </div>
  )
}
