/**
 * `PriceFields`: the amount fields of a price entry, under the pricing switches. The list
 * price always; the bulk price and its minimum while Precio por cantidad is on; "Precio VIP"
 * while Clientes VIP is on. It is controlled: its host holds the values and the errors, and
 * decides when and where they are sent. Which field a refusal code is about lives in
 * `priceFieldRules.ts`, so a second host maps a refusal to a field without restating any rule.
 */

import type { PricingSettings } from '../../api/pricingSettings'
import type { PriceErrors, PriceValues } from './priceFieldRules'
import {
  BULK_PRICE,
  LIST_PRICE,
  MINIMUM_QUANTITY,
  PRICE_DISCOUNT_HELP,
  PRICE_FROM_GRAMS_HELP,
  PRICE_PER_GRAM_HELP,
  VIP_PRICE,
} from '../../copy/varieties'

/** The field each input writes: codes of `PriceValues`, never words. */
type PriceFieldCode = 'listPrice' | 'bulkPrice' | 'bulkMinimum' | 'vipPrice'
const LIST_PRICE_FIELD: PriceFieldCode = 'listPrice'
const BULK_PRICE_FIELD: PriceFieldCode = 'bulkPrice'
const BULK_MINIMUM_FIELD: PriceFieldCode = 'bulkMinimum'
const VIP_PRICE_FIELD: PriceFieldCode = 'vipPrice'

export function FieldError({ message }: { message: string | undefined }) {
  if (message === undefined) return null
  return (
    <span className="campo__error" role="alert">
      {message}
    </span>
  )
}

interface AmountInputProps {
  className: string
  value: string
  onChange: (value: string) => void
  required?: boolean
}

/**
 * A pesos input with the "$" before it. The sign is drawn, not typed: it is hidden from the
 * accessible name and never part of the value, so a fill and a payload see digits only.
 */
function AmountInput({ className, value, onChange, required }: AmountInputProps) {
  return (
    <span className="campo__monto">
      <span className="campo__prefijo" aria-hidden="true">$</span>
      <input
        className={className}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
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
  return (
    <>
      <label className="campo">
        <span className="campo__rotulo">{LIST_PRICE}</span>
        <AmountInput
          className="campo__input campo__input--monto"
          value={values.listPrice}
          onChange={(value) => onChange(LIST_PRICE_FIELD, value)}
          required
        />
        <span className="campo__ayuda" data-copy="help">{PRICE_PER_GRAM_HELP}</span>
        <FieldError message={errors.listPrice} />
      </label>
      {settings.is_bulk_pricing && (
        <>
          <label className="campo">
            <span className="campo__rotulo">{BULK_PRICE}</span>
            <AmountInput
              className="campo__input"
              value={values.bulkPrice}
              onChange={(value) => onChange(BULK_PRICE_FIELD, value)}
            />
            <span className="campo__ayuda" data-copy="help">{PRICE_DISCOUNT_HELP}</span>
            <FieldError message={errors.bulkPrice} />
          </label>
          <label className="campo">
            <span className="campo__rotulo">{MINIMUM_QUANTITY}</span>
            <input
              className="campo__input"
              inputMode="decimal"
              value={values.bulkMinimum}
              onChange={(event) => onChange(BULK_MINIMUM_FIELD, event.target.value)}
            />
            <span className="campo__ayuda" data-copy="help">{PRICE_FROM_GRAMS_HELP}</span>
            <FieldError message={errors.bulkMinimum} />
          </label>
        </>
      )}
      {settings.is_vip_customers && (
        <label className="campo">
          <span className="campo__rotulo">{VIP_PRICE}</span>
          <AmountInput
            className="campo__input"
            value={values.vipPrice}
            onChange={(value) => onChange(VIP_PRICE_FIELD, value)}
          />
          <span className="campo__ayuda" data-copy="help">{PRICE_DISCOUNT_HELP}</span>
          <FieldError message={errors.vipPrice} />
        </label>
      )}
    </>
  )
}
