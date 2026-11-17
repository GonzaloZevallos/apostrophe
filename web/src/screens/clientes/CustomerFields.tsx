import { useEffect, useId, useRef } from 'react'
import { NetworkError } from '../../api/client'
import ErrorGenerico from '../../components/ErrorGenerico'
import Selector from '../../components/Selector'
import SinConexion from '../../components/SinConexion'
import { CUSTOMERS_TEXT, phoneAdjective, phoneCountryName, phoneLengthsText } from '../../copy/customers'
import { COMMON_TEXT } from '../../copy/common'
import { choiceId, choiceOfId, OTHER_ID } from '../../phone/countryState'
import type { PhoneCountryField } from './usePhoneCountryField'

/**
 * The shared "Nombre / Teléfono" fields (`NuevaVentaCliente.dc.html`,
 * `ClienteForm.tsx`): split out of `ClienteForm` (plan, "Shape") so the "Nuevo
 * cliente" sub-form inside `NuevaVentaCliente`'s sheet renders exactly the same
 * markup, labels and structure as /clientes/nuevo — one place that knows what a
 * customer's fields look like, not two copies drifting apart.
 *
 * Purely controlled, and it never calls the API or navigates anywhere (plan,
 * invariants: "Embedding `CustomerFields` in the sheet never navigates; only the
 * /clientes route wrapper navigates or shows 'Cliente guardado'."): the caller
 * (`ClienteForm` or `NuevaVentaCliente`) owns the state, the save call and what
 * happens next.
 */

export interface CustomerFieldsValue {
  name: string
  phone: string
}

export interface CustomerFieldsProps {
  value: CustomerFieldsValue
  onChange: (value: CustomerFieldsValue) => void
  nameError: string | null
  phoneError: string | null
  /** The server refused the number as not fitting (`customer.phone_invalid`): the field then names the shown country and its lengths. */
  phoneInvalid: boolean
  /** The Phone country of this form (`usePhoneCountryField`): the caller sends its `requestCountry`. */
  country: PhoneCountryField
  /** Where the phone's Phone country list is drawn when the sheet around the form must be covered (`inert`) beneath it. */
  listHost?: HTMLElement | null
}

export default function CustomerFields({
  value,
  onChange,
  nameError,
  phoneError,
  phoneInvalid,
  country,
  listHost,
}: CustomerFieldsProps) {
  const nameRef = useRef<HTMLInputElement>(null)
  const phoneId = useId()
  const phoneHintId = useId()
  const countryFailureId = useId()
  const { countries, choice } = country
  const shownPhoneError = phoneInvalid ? phoneInvalidText(country) : phoneError
  // Kept true until the list loaded: a failed load never looks like a country.
  const loading = !country.ready
  // The example of the shown country; Other has none and says how to type the number.
  const phonePlaceholder =
    countries === undefined
      ? undefined
      : choice.kind === 'country'
        ? countries.find((option) => option.code === choice.code)?.example
        : choice.kind === 'other'
          ? CUSTOMERS_TEXT.phoneHintNone
          : undefined
  const countryOptions = [
    ...(countries ?? []).map((option) => {
      const name = phoneCountryName(option.code)
      return {
        value: option.code,
        label: CUSTOMERS_TEXT.phoneCountryOption(name, option.calling_code),
        // The "(+code)" part of the label, from the same Copy function, kept in one run.
        figure: CUSTOMERS_TEXT.phoneCountryOption('', option.calling_code).trim(),
      }
    }),
    { value: OTHER_ID, label: CUSTOMERS_TEXT.phoneCountryOther },
  ]

  // The drawing opens with Name focused (`NuevaVentaCliente.dc.html`): once, on mount.
  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  return (
    <>
      <div className="campo">
        <label className="campo">
          <span className="campo__rotulo">{COMMON_TEXT.name}</span>
          <input
            ref={nameRef}
            className="campo__input campo__input--enfoque"
            type="text"
            autoComplete="off"
            value={value.name}
            onChange={(event) => onChange({ ...value, name: event.target.value })}
            required
          />
        </label>
        {nameError !== null && (
          <span className="campo__error" role="alert">
            {nameError}
          </span>
        )}
      </div>
      <div className="cliente-fila cliente-fila--telefono">
        <div className="campo cliente-fila__pais">
          {(() => {
            const shared = {
              label: CUSTOMERS_TEXT.phoneCountryLabel,
              required: true as const,
              options: countryOptions,
              // Never shown: Other is always an option.
              emptySetMessage: CUSTOMERS_TEXT.phoneCountryOther,
              value: choiceId(choice),
              onChange: (next: string | null) => {
                if (next !== null) country.pick(choiceOfId(next))
              },
              loading,
              listHost,
              describedBy: country.failure === null ? undefined : countryFailureId,
            }
            return country.locked ? (
              <Selector {...shared} locked lockedReason={CUSTOMERS_TEXT.phoneCountryLockedReason} />
            ) : (
              <Selector {...shared} />
            )
          })()}
        </div>
        <div className="campo cliente-fila__telefono">
          <span className="campo__rotulo">
            <label htmlFor={phoneId}>{CUSTOMERS_TEXT.phone}</label>{' '}
            <span id={phoneHintId}>{CUSTOMERS_TEXT.phoneOptional}</span>
          </span>
          <input
            id={phoneId}
            className="campo__input campo__input--enfoque"
            type="tel"
            autoComplete="off"
            value={value.phone}
            aria-describedby={phoneHintId}
            placeholder={phonePlaceholder}
            onChange={(event) => {
              country.type(event.target.value)
              onChange({ ...value, phone: event.target.value })
            }}
          />
          {shownPhoneError !== null && (
            <span className="campo__error" role="alert">
              {shownPhoneError}
            </span>
          )}
        </div>
      </div>
      {country.failure !== null && (
        <div id={countryFailureId}>{country.failure instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />}</div>
      )}
    </>
  )
}

/** The text of a `customer.phone_invalid` rejection: it names the shown country and the lengths
 * the API serves for it; with Other shown there is no country to name, so the generic text. */
function phoneInvalidText(field: PhoneCountryField): string {
  const { choice, countries } = field
  const listing = choice.kind === 'country' ? countries?.find((option) => option.code === choice.code) : undefined
  if (listing === undefined) return CUSTOMERS_TEXT.notAPhone
  return CUSTOMERS_TEXT.phoneInvalidFor(phoneAdjective(listing.code), phoneLengthsText(listing.national_lengths))
}
