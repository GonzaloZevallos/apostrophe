/**
 * "Precios" (`ConfiguracionPrecios.dc.html`, `ConfiguracionPreciosCompu.dc.html`;
 * `pricing-settings.md`): the business's two pricing switches, Precio por cantidad and
 * Clientes VIP. A form like the other business-wide groups: "Cerrar", the unsaved-changes
 * question, "Guardá los precios" and the toast "Precios guardados" (no data in it).
 *
 * Two fixed lines: one says that past sales keep their price and that switching off deletes
 * nothing, the other sits under the VIP switch, on or off, and says each variety needs its
 * VIP price. Neither carries a count or a list. On and off are told by the switch's thumb and
 * `aria-checked`, never by color alone.
 *
 * `dirty` is the switches against `accepted`: the pair the server last accepted, taken once
 * from the first read and reset from the PUT answer. It is never compared with the query
 * cache, which a save rewrites and a partner's edit can move under the form.
 */

import { type FormEvent, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, NetworkError, UNKNOWN_CODE } from '../../api/client'
import {
  type PricingSettings,
  pricingSettingsQueryOptions,
  savePricingSettings,
  writePricingSettings,
} from '../../api/pricingSettings'
import { kindOf } from '../../api/refusals'
import AvisoExito from '../../components/AvisoExito'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import Loading from '../../components/Loading'
import OpcionInterruptor from '../../components/OpcionInterruptor'
import SinConexion from '../../components/SinConexion'
import { GENERIC_REFUSAL_MESSAGE, PRICES_SAVED } from './messages'
import SettingsGroup from './SettingsGroup'

const TITLE = 'Precios'

export const PAST_SALES_LINE =
  'Las ventas ya hechas conservan el precio con el que se registraron. Apagar una opción no borra nada.'
export const VIP_HELP_LINE =
  'Cada variedad necesita su precio VIP: sin él, un cliente VIP paga como cualquiera.'

const LEAVE = {
  question: '¿Descartás los precios?',
  detail: 'Se pierde lo que cargaste: todavía no se guardó nada.',
  keepLabel: 'No, seguí editando',
  discardLabel: 'Sí, descartalo',
}

export default function PricingGroup() {
  const { data, isPending, isError, error } = useQuery(pricingSettingsQueryOptions())

  if (isPending || isError) {
    return (
      <SettingsGroup title={TITLE} dirty={false} leave={LEAVE}>
        {isPending && <Loading />}
        {isError && (error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />)}
      </SettingsGroup>
    )
  }
  return <PricingForm initial={data} />
}

function PricingForm({ initial }: { initial: PricingSettings }) {
  const queryClient = useQueryClient()
  const [accepted, setAccepted] = useState(initial)
  const [bulk, setBulk] = useState(initial.is_bulk_pricing)
  const [vip, setVip] = useState(initial.is_vip_customers)
  const [genericError, setGenericError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function clearFeedback(): void {
    setGenericError(null)
    setOffline(false)
    setSaved(false)
  }

  async function onSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    clearFeedback()
    setSaving(true)
    try {
      const view = await savePricingSettings({ is_bulk_pricing: bulk, is_vip_customers: vip })
      writePricingSettings(queryClient, view)
      setAccepted(view)
      setBulk(view.is_bulk_pricing)
      setVip(view.is_vip_customers)
      setSaved(true)
    } catch (caught) {
      if (caught instanceof NetworkError) setOffline(true)
      else if (caught instanceof ApiError) {
        setGenericError(
          caught.code !== UNKNOWN_CODE && kindOf(caught.code) === 'refusal'
            ? GENERIC_REFUSAL_MESSAGE
            : ERROR_GENERICO_MENSAJE,
        )
      } else setGenericError(ERROR_GENERICO_MENSAJE)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsGroup
      title={TITLE}
      dirty={bulk !== accepted.is_bulk_pricing || vip !== accepted.is_vip_customers}
      leave={LEAVE}
    >
      {saved && (
        <div className="aviso-flotante">
          <AvisoExito texto={PRICES_SAVED} />
        </div>
      )}
      <form className="formulario" onSubmit={onSave}>
        <OpcionInterruptor
          label="Precio por cantidad"
          checked={bulk}
          onChange={(next) => {
            setBulk(next)
            clearFeedback()
          }}
        />
        <OpcionInterruptor
          label="Clientes VIP"
          checked={vip}
          onChange={(next) => {
            setVip(next)
            clearFeedback()
          }}
        />
        <span className="campo__ayuda">{VIP_HELP_LINE}</span>
        <span className="campo__ayuda">{PAST_SALES_LINE}</span>
        {genericError !== null && (
          <span className="campo__error" role="alert">
            {genericError}
          </span>
        )}
        {offline && <SinConexion />}
        <button className="boton" type="submit" disabled={saving}>
          Guardá los precios
        </button>
      </form>
    </SettingsGroup>
  )
}
