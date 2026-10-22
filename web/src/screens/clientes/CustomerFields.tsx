import { useEffect, useId, useRef } from 'react'
import OpcionInterruptor from '../../components/OpcionInterruptor'
import { CUSTOMERS_TEXT } from '../../copy/customers'
import { COMMON_TEXT } from '../../copy/common'
/**
 * The shared "Nombre / Teléfono / VIP" fields (`NuevaVentaCliente.dc.html`,
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
  vip: boolean
}

export interface CustomerFieldsProps {
  value: CustomerFieldsValue
  onChange: (value: CustomerFieldsValue) => void
  nameError: string | null
  phoneError: string | null
  /** Clientes VIP is on: the VIP field shows only then, with nothing in its place. */
  showVip: boolean
}

export default function CustomerFields({
  value,
  onChange,
  nameError,
  phoneError,
  showVip,
}: CustomerFieldsProps) {
  const nameRef = useRef<HTMLInputElement>(null)
  const phoneId = useId()
  const phoneHintId = useId()

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
            value={value.phone}
            aria-describedby={phoneHintId}
            onChange={(event) => onChange({ ...value, phone: event.target.value })}
          />
          {phoneError !== null && (
            <span className="campo__error" role="alert">
              {phoneError}
            </span>
          )}
        </div>
        {showVip && (
          <div className="campo cliente-fila__vip">
            <span className="campo__rotulo" aria-hidden="true">
              {COMMON_TEXT.vip}
            </span>
            <OpcionInterruptor
              label={value.vip ? CUSTOMERS_TEXT.yes : CUSTOMERS_TEXT.off}
              ariaLabel={COMMON_TEXT.vip}
              checked={value.vip}
              onChange={(vip) => onChange({ ...value, vip })}
            />
          </div>
        )}
      </div>
    </>
  )
}
