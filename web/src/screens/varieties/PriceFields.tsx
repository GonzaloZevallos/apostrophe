/**
 * `PriceFields`: the amount fields of a price entry, under the pricing switches. The list
 * price always; the bulk price and its minimum while Precio por cantidad is on; "Precio VIP"
 * while Clientes VIP is on. It is controlled: its host holds the values and the errors, and
 * decides when and where they are sent. Which field a refusal code is about lives in
 * `priceFieldRules.ts`, so a second host maps a refusal to a field without restating any rule.
 */

import { useId } from 'react'
import MoneyInput from '../../components/MoneyInput'
import { useMoney } from '../../format/moneyContext'
import type { PricingSettings } from '../../api/pricingSettings'
import type { PriceErrors, PriceValues } from './priceFieldRules'
import { PRICE_DISCOUNT_HELP, PRICE_FROM_GRAMS_HELP, PRICE_PER_GRAM_HELP, VARIETIES_TEXT } from '../../copy/varieties'
import { COMMON_TEXT } from '../../copy/common'

export function FieldError({ message, id }: { message: string | undefined; id?: string }) {
  if (message === undefined) return null
  return (
    <span id={id} className="campo__error" role="alert">
      {message}
    </span>
  )
}

/**
 * What a typed control points at: its own label span (its name is that word alone, never the help
 * or the error the wrapping `<label>` also holds) and its help and error (its description).
 */
export interface FieldIds {
  labelledBy: string
  describedBy: string
}

/** The ids of one field's label, help and error spans, from one `useId`. */
export function fieldIds(base: string): { label: string; help: string; error: string } {
  return { label: `${base}-rotulo`, help: `${base}-ayuda`, error: `${base}-error` }
}

/** The description of a field: its help, and its error while one is shown. */
export function describedBy(ids: { help: string; error: string }, error: string | undefined): string {
  return error === undefined ? ids.help : `${ids.help} ${ids.error}`
}

interface AmountInputProps {
  className: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  ids: FieldIds
}

/**
 * An amount input with the business's symbol before it. The sign is drawn, not typed: it is hidden from the
 * accessible name and never part of the value, so a fill and a payload see digits only.
 */
function AmountInput({ className, value, onChange, required, ids }: AmountInputProps) {
  const { symbol } = useMoney().format
  return (
    <span className="campo__monto">
      <span className="campo__prefijo" aria-hidden="true">{symbol}</span>
      <MoneyInput
        className={className}
        value={value}
        onChange={onChange}
        required={required}
        aria-labelledby={ids.labelledBy}
        aria-describedby={ids.describedBy}
      />
    </span>
  )
}

export interface PriceFieldsProps {
  /** The switches in force: a rule that is off has no field. */
  settings: PricingSettings
  values: PriceValues
  errors: PriceErrors
  onChange: (field: keyof PriceValues, value: string) => void
}

export default function PriceFields({ settings, values, errors, onChange }: PriceFieldsProps) {
  const base = useId()
  const list = fieldIds(`${base}-lista`)
  const bulk = fieldIds(`${base}-mayor`)
  const minimum = fieldIds(`${base}-minimo`)
  const vip = fieldIds(`${base}-vip`)
  return (
    <>
      <label className="campo">
        <span id={list.label} className="campo__rotulo">{VARIETIES_TEXT.precioDeLista}</span>
        <AmountInput
          className="campo__input campo__input--monto"
          value={values.listPrice}
          onChange={(value) => onChange('listPrice', value)}
          required
          ids={{ labelledBy: list.label, describedBy: describedBy(list, errors.listPrice) }}
        />
        <span id={list.help} className="campo__ayuda" data-copy="help">{PRICE_PER_GRAM_HELP}</span>
        <FieldError id={list.error} message={errors.listPrice} />
      </label>
      {settings.is_bulk_pricing && (
        <>
          <label className="campo">
            <span id={bulk.label} className="campo__rotulo">{COMMON_TEXT.bulkPrice}</span>
            <AmountInput
              className="campo__input"
              value={values.bulkPrice}
              onChange={(value) => onChange('bulkPrice', value)}
              ids={{ labelledBy: bulk.label, describedBy: describedBy(bulk, errors.bulkPrice) }}
            />
            <span id={bulk.help} className="campo__ayuda" data-copy="help">{PRICE_DISCOUNT_HELP}</span>
            <FieldError id={bulk.error} message={errors.bulkPrice} />
          </label>
          <label className="campo">
            <span id={minimum.label} className="campo__rotulo">{VARIETIES_TEXT.minimoEnGramos}</span>
            <input
              className="campo__input"
              inputMode="decimal"
              value={values.bulkMinimum}
              onChange={(event) => onChange('bulkMinimum', event.target.value)}
              aria-labelledby={minimum.label}
              aria-describedby={describedBy(minimum, errors.bulkMinimum)}
            />
            <span id={minimum.help} className="campo__ayuda" data-copy="help">{PRICE_FROM_GRAMS_HELP}</span>
            <FieldError id={minimum.error} message={errors.bulkMinimum} />
          </label>
        </>
      )}
      {settings.is_vip_customers && (
        <label className="campo">
          <span id={vip.label} className="campo__rotulo">{VARIETIES_TEXT.precioVip}</span>
          <AmountInput
            className="campo__input"
            value={values.vipPrice}
            onChange={(value) => onChange('vipPrice', value)}
            ids={{ labelledBy: vip.label, describedBy: describedBy(vip, errors.vipPrice) }}
          />
          <span id={vip.help} className="campo__ayuda" data-copy="help">{PRICE_DISCOUNT_HELP}</span>
          <FieldError id={vip.error} message={errors.vipPrice} />
        </label>
      )}
    </>
  )
}
