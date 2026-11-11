import { useEffect, useId, useRef } from 'react'
import { usePhoneCountry } from '../../api/phoneCountry'
import { CUSTOMERS_TEXT, phoneHint } from '../../copy/customers'
import { COMMON_TEXT } from '../../copy/common'
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
}

export default function CustomerFields({
  value,
  onChange,
  nameError,
  phoneError,
}: CustomerFieldsProps) {
  const nameRef = useRef<HTMLInputElement>(null)
  const phoneId = useId()
  const phoneHintId = useId()
  const phoneCountry = usePhoneCountry()

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
      <div className="cliente-fila">
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
            placeholder={phoneCountry.loaded ? phoneHint(phoneCountry.country) : undefined}
            onChange={(event) => onChange({ ...value, phone: event.target.value })}
          />
          {phoneError !== null && (
            <span className="campo__error" role="alert">
              {phoneError}
            </span>
          )}
        </div>
      </div>
    </>
  )
}
