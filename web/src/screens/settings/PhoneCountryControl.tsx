/**
 * The Phone country control of the Business group: a radio group over the `PHONE_COUNTRIES` fixed
 * set (the countries the shared rules table holds and the Copy module names). The API's list only
 * narrows it and gives each country its calling code, which the front never holds. A stored
 * country the set does not hold is plain text before the group: no role, no pressed state, no
 * chip class, never offered (`tests/test_phone_country_front_names.py` keeps the set equal to the
 * server's enum).
 */

import { useId } from 'react'
import type { PhoneCountryOption } from '../../api/phoneCountry'
import { NO_COUNTRY, PHONE_COUNTRIES } from '../../components/fixedSets'
import Icono from '../../components/Icono'
import { SETTINGS_TEXT } from '../../copy/settings'

interface PhoneCountryControlProps {
  options: readonly PhoneCountryOption[]
  value: string | null
  onChange: (value: string | null) => void
  error: string | null
  disabled: boolean
}

/**
 * The Phone country control: "No country" first, then the set's countries (the server's enum order) that the API lists, each as
 * its name and calling code. A single-choice group whose selected row carries a check beside its
 * text, never colour alone. It only chooses; the form's Save sends it. The help line is its
 * accessible description.
 */
export default function PhoneCountryControl({ options, value, onChange, error, disabled }: PhoneCountryControlProps) {
  const labelId = useId()
  const helpId = useId()
  const known = value === null || PHONE_COUNTRIES.some((option) => option.value === value)
  const calling = new Map(options.map((option) => [option.code, option.calling_code]))
  return (
    <div className="ajustes-idioma">
      <span className="rotulo ajustes-tema__rotulo" id={labelId}>
        {SETTINGS_TEXT.phoneCountryLabel}
      </span>
      {value !== null && !known && <span className="campo__ayuda">{SETTINGS_TEXT.currentPhoneCountry(value)}</span>}
      <div
        className="ajustes-tema ajustes-tema--columna"
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={helpId}
      >
        {PHONE_COUNTRIES.filter((option) => option.value === NO_COUNTRY || calling.has(option.value)).map((option) => {
          const code = option.value === NO_COUNTRY ? null : option.value
          const checked = code === value
          const callingCode = code === null ? undefined : calling.get(code)
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={disabled}
              className={checked ? 'ajustes-tema__opcion ajustes-tema__opcion--activa' : 'ajustes-tema__opcion'}
              onClick={() => onChange(code)}
            >
              {checked && <Icono nombre="hecho" />}
              {callingCode === undefined ? option.label() : SETTINGS_TEXT.phoneCountryOption(option.label(), callingCode)}
            </button>
          )
        })}
      </div>
      <p className="ajustes-tema__ayuda" id={helpId}>
        {SETTINGS_TEXT.phoneCountryHelp}
      </p>
      {error !== null && (
        <span className="campo__error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
