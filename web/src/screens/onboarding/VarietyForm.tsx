/**
 * Step 1's one form (`OnboardingVariedad.dc.html`): the variety's name, its list price and
 * the price form's optional fields under the pricing switches, and one primary action that
 * saves the variety and then its price (`useVarietyWithPrice`). It holds its own saved
 * variety, seeded once from the `seed` the host passes (a variety saved with no price): the
 * host's later answers never remount it, so what was typed in the price survives the variety
 * write. Once the variety is saved its name shows as text. The host re-keys the form to
 * start the next variety fresh.
 */

import { type FormEvent, useEffect, useState } from 'react'
import type { OnboardingTarget } from '../../api/onboarding'
import type { PricingSettings } from '../../api/pricingSettings'
import Boton from '../../components/Boton'
import SinConexion from '../../components/SinConexion'
import PriceFields, { FieldError } from '../varieties/PriceFields'
import type { PriceValues } from '../varieties/priceFieldRules'
import { VARIETY_NAME_HELP } from '../varieties/priceMessages'
import { useVarietyWithPrice } from './useVarietyWithPrice'

export interface VarietyFormProps {
  seed: OnboardingTarget | null
  today: string
  settings: PricingSettings
  /** `partlySaved` is true once the variety is saved: only the price is left to lose. */
  onDirtyChange: (dirty: boolean, partlySaved?: boolean) => void
  onPriced: () => void
}

const EMPTY: PriceValues = { listPrice: '', bulkPrice: '', bulkMinimum: '', vipPrice: '' }

export default function VarietyForm({ seed, today, settings, onDirtyChange, onPriced }: VarietyFormProps) {
  const [name, setName] = useState('')
  const [values, setValues] = useState<PriceValues>(EMPTY)
  const { saved, sending, nameError, priceErrors, offline, submit } = useVarietyWithPrice({
    seed,
    today,
    settings,
    onDirtyChange,
    onPriced,
  })

  const pricing = Object.values(values).some((value) => value !== '')
  const dirty = pricing || (saved === null && name !== '')
  const partlySaved = saved !== null
  useEffect(() => {
    onDirtyChange(dirty, partlySaved)
  }, [dirty, partlySaved, onDirtyChange])

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    void submit(name, values)
  }

  return (
    <form className="formulario" onSubmit={onSubmit}>
      {saved === null ? (
        <label className="campo">
          <span className="campo__rotulo">Nombre</span>
          <input
            className="campo__input"
            type="text"
            placeholder="Nombre de la variedad"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <span className="pie" data-copy="help">{VARIETY_NAME_HELP}</span>
          <FieldError message={nameError ?? undefined} />
        </label>
      ) : (
        <p className="pie">{`Variedad: ${saved.name}`}</p>
      )}
      <PriceFields
        settings={settings}
        values={values}
        errors={priceErrors}
        onChange={(field, value) => setValues((current) => ({ ...current, [field]: value }))}
      />
      <FieldError message={priceErrors.form} />
      {offline && <SinConexion />}
      <Boton textOnly="submit" type="submit" disabled={sending}>
        Guardá la variedad
      </Boton>
    </form>
  )
}
