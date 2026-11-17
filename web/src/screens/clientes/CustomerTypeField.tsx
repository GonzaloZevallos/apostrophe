/**
 * The Customer form's "Customer type" field (customers.md): an optional Selector over the
 * Business's types (icon beside name) whose empty wording is "No type"; the list offers the
 * clearing row only while a type is chosen. While the types load, or after a failed load, the
 * Selector stays mounted in `loading` (never "No type", never the notice) and a failed load shows
 * the screen's own failure line under it. While the Business has no types the Selector gives way
 * to the Tappable notice "Add a customer type", which leads to Settings → Prices, where the types
 * are created. Purely controlled; the form decides whether to show it (only while Customer types
 * is on) and owns the value and the save. `value` is the type's id as text; `''` is "No type".
 */

import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { NetworkError } from '../../api/client'
import { useCustomerTypes } from '../../api/customerTypes'
import BotonLink from '../../components/BotonLink'
import ErrorGenerico from '../../components/ErrorGenerico'
import Icono from '../../components/Icono'
import Selector from '../../components/Selector'
import SinConexion from '../../components/SinConexion'
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
  const { t } = useTranslation()
  const failureId = useId()
  const refusalId = useId()
  const typesQuery = useCustomerTypes()
  const types = typesQuery.data
  // Kept true until a load succeeds: a failed load never looks like zero types.
  const loading = typesQuery.isPending || typesQuery.isError

  if (!loading && types !== undefined && types.length === 0) {
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

  const failed = typesQuery.isError
  // One message at a time: the refusal, or else the load failure.
  const describedBy = error !== null ? refusalId : failed ? failureId : undefined

  return (
    <div className="campo">
      <Selector
        label={CUSTOMERS_TEXT.typeLabel}
        emptyWording={t('common:noType')}
        // Never shown: the list cannot open while loading, and no types gives way to the notice.
        emptySetMessage={CUSTOMERS_TEXT.typeNotice}
        options={(types ?? []).map((type) => ({
          value: String(type.id),
          label: type.name,
          glyph: glyphOf(type.icon),
        }))}
        value={value === '' ? null : value}
        onChange={(next) => onChange(next ?? '')}
        loading={loading}
        describedBy={describedBy}
      />
      {failed && <div id={failureId}>{typesQuery.error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />}</div>}
      {error !== null && (
        <span id={refusalId} className="campo__error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
