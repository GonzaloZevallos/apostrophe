/**
 * The Customer form's "Customer type" field (customers.md): a select that always offers "No type"
 * first, then the Business's types (icon beside name). While the Business has no types the
 * select gives way to the Tappable notice "Add a customer type", which leads to Settings →
 * Prices, where the types are created. Purely controlled; the form decides whether to show it
 * (only while Customer types is on) and owns the value and the save.
 */

import { useId } from 'react'
import BotonLink from '../../components/BotonLink'
import Icono from '../../components/Icono'
import { useCustomerTypes } from '../../api/customerTypes'
import { CUSTOMERS_TEXT } from '../../copy/customers'
import { glyphOf } from '../../customerTypes/icons'
import { SETTINGS_CUSTOMER_TYPES } from '../../routes'

export interface CustomerTypeFieldProps {
  /** The chosen type's id as text; `''` is "No type". */
  value: string
  onChange: (value: string) => void
  error: string | null
}

export default function CustomerTypeField({ value, onChange, error }: CustomerTypeFieldProps) {
  const selectId = useId()
  const types = useCustomerTypes().data

  if (types === undefined) return null

  if (types.length === 0) {
    return (
      <div className="campo">
        <span className="campo__rotulo">{CUSTOMERS_TEXT.typeLabel}</span>
        <BotonLink variant="notice" to={SETTINGS_CUSTOMER_TYPES}>
          <span className="aviso-onboarding__titulo">
            <span className="aviso-onboarding__texto">{CUSTOMERS_TEXT.typeNotice}</span>
            <Icono nombre="chevron" />
          </span>
        </BotonLink>
      </div>
    )
  }

  return (
    <div className="campo">
      <label className="campo" htmlFor={selectId}>
        <span className="campo__rotulo">{CUSTOMERS_TEXT.typeLabel}</span>
      </label>
      <select
        id={selectId}
        className="campo__input"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{CUSTOMERS_TEXT.typeNone}</option>
        {types.map((type) => (
          <option key={type.id} value={String(type.id)}>
            {`${glyphOf(type.icon)} ${type.name}`}
          </option>
        ))}
      </select>
      {error !== null && (
        <span className="campo__error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
