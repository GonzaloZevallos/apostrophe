/**
 * The shared "Teléfono / Nombre / Canal / VIP" fields (`NuevaVentaCliente.dc.html`,
 * `ClienteForm.tsx`): split out of `ClienteForm` (plan, "Shape") so the "Nuevo
 * cliente" sub-form inside `NuevaVentaCliente`'s sheet renders exactly the same
 * markup, labels and structure as `/clientes/nuevo` — one place that knows what a
 * customer's fields look like, not two copies drifting apart.
 *
 * Purely controlled, and it never calls the API or navigates anywhere (plan,
 * invariants: "Embedding `CustomerFields` in the sheet never navigates; only the
 * `/clientes` route wrapper navigates or shows 'Cliente guardado'."): the caller
 * (`ClienteForm` or `NuevaVentaCliente`) owns the state, the save call and what
 * happens next.
 */

import type { Channel } from '../../api/customers'

export interface CustomerFieldsValue {
  name: string
  phone: string
  channel: Channel | null
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
  return (
    <>
      <div className="campo">
        <label className="campo">
          <span className="campo__rotulo">Teléfono</span>
          <input
            className="campo__input"
            type="tel"
            value={value.phone}
            onChange={(event) => onChange({ ...value, phone: event.target.value })}
          />
        </label>
        {phoneError !== null && (
          <span className="campo__error" role="alert">
            {phoneError}
          </span>
        )}
      </div>
      <div className="campo">
        <label className="campo">
          <span className="campo__rotulo">Nombre</span>
          <input
            className="campo__input"
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
      <fieldset className="campo">
        <legend className="campo__rotulo">Canal</legend>
        <label>
          <input
            type="radio"
            name="channel"
            checked={value.channel === null}
            onChange={() => onChange({ ...value, channel: null })}
          />
          Ninguno
        </label>
        <label>
          <input
            type="radio"
            name="channel"
            checked={value.channel === 'whatsapp'}
            onChange={() => onChange({ ...value, channel: 'whatsapp' })}
          />
          WhatsApp
        </label>
        <label>
          <input
            type="radio"
            name="channel"
            checked={value.channel === 'telegram'}
            onChange={() => onChange({ ...value, channel: 'telegram' })}
          />
          Telegram
        </label>
      </fieldset>
      {showVip && (
        <label className="campo">
          <span className="campo__rotulo">VIP</span>
          <input
            type="checkbox"
            checked={value.vip}
            onChange={(event) => onChange({ ...value, vip: event.target.checked })}
          />
        </label>
      )}
    </>
  )
}
