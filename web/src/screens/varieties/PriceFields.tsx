/**
 * `PriceFields`: the amount fields of a price entry, under the pricing switches. The list
 * price always; the bulk price and its minimum while Precio por cantidad is on; "Precio VIP"
 * while Clientes VIP is on. It is controlled: its host holds the values and the errors, and
 * decides when and where they are sent. Which field a refusal code is about lives in
 * `priceFieldRules.ts`, so a second host maps a refusal to a field without restating any rule.
 */

import type { PricingSettings } from '../../api/pricingSettings'
import type { PriceErrors, PriceValues } from './priceFieldRules'
import { PRICE_DISCOUNT_HELP, PRICE_FROM_GRAMS_HELP, PRICE_PER_GRAM_HELP } from './priceMessages'

export function FieldError({ message }: { message: string | undefined }) {
  if (message === undefined) return null
  return (
    <span className="campo__error" role="alert">
      {message}
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
        <span className="campo__rotulo">Precio de lista</span>
        <input
          className="campo__input campo__input--monto"
          inputMode="numeric"
          value={values.listPrice}
          onChange={(event) => onChange('listPrice', event.target.value)}
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
              value={values.bulkPrice}
              onChange={(event) => onChange('bulkPrice', event.target.value)}
            />
            <span className="campo__ayuda" data-copy="help">{PRICE_DISCOUNT_HELP}</span>
            <FieldError message={errors.bulkPrice} />
          </label>
          <label className="campo">
            <span className="campo__rotulo">Mínimo en gramos</span>
            <input
              className="campo__input"
              inputMode="decimal"
              value={values.bulkMinimum}
              onChange={(event) => onChange('bulkMinimum', event.target.value)}
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
            value={values.vipPrice}
            onChange={(event) => onChange('vipPrice', event.target.value)}
          />
          <span className="campo__ayuda" data-copy="help">{PRICE_DISCOUNT_HELP}</span>
          <FieldError message={errors.vipPrice} />
        </label>
      )}
    </>
  )
}
