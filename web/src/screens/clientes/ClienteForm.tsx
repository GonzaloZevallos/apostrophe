/**
 * The "Nuevo cliente" form (`NuevaVentaCliente.dc.html`), shared by add
 * (`/clientes/nuevo`) and edit (`/clientes/:id/editar`): name and phone are both
 * required (PRD round 1, "the human decided"). A refusal maps to its field
 * through `refusals.ts`; a phone or name refusal never repeats what was typed —
 * the field simply keeps it and shows the fixed message next to it. Saving an
 * edit that lands on a `gone` id closes the form, refreshes the list and shows
 * `GONE_NOTICE` instead (plan, "Gone records").
 *
 * `ClienteForm` only gates on the existing customer loading before mounting
 * `ClienteFormBody`, so the body's `useState` initializers run once, already with
 * the right values — no effect re-seeds state after a render (oxlint's
 * `set-state-in-effect`).
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ApiError, NetworkError } from '../../api/client'
import {
  type Channel,
  type Customer,
  editCustomer,
  getCustomer,
  registerCustomer,
} from '../../api/customers'
import { invalidateResource, keys } from '../../api/keys'
import { GONE_NOTICE, isGone, resolveOverride, type RefusalCode } from '../../api/refusals'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import GoneScreen from '../../components/GoneScreen'
import SinConexion from '../../components/SinConexion'

export const SAVED_TOAST = 'Cliente guardado'
export const NAME_REQUIRED = 'Ponele un nombre'
export const PHONE_INVALID = 'Eso no parece un teléfono con su código de área'
export const PHONE_TAKEN = 'Ese teléfono ya es de otro cliente'
export const GENERIC_REFUSAL = 'Revisá los datos e intentá de nuevo.'

type Field = 'name' | 'phone' | 'form'

const FIELD_OVERRIDES: Partial<Record<RefusalCode, { field: Field; message: string }>> = {
  'customer.name_missing': { field: 'name', message: NAME_REQUIRED },
  'customer.name_too_long': { field: 'name', message: 'El nombre es demasiado largo' },
  'customer.phone_invalid': { field: 'phone', message: PHONE_INVALID },
  'customer.phone_taken': { field: 'phone', message: PHONE_TAKEN },
}

interface Props {
  mode: 'nuevo' | 'editar'
}

export default function ClienteForm({ mode }: Props) {
  const { id } = useParams<{ id: string }>()
  const customerId = id ?? ''

  const existing = useQuery({
    queryKey: keys.customer(customerId),
    queryFn: () => getCustomer(customerId),
    enabled: mode === 'editar',
  })

  if (mode === 'nuevo') return <ClienteFormBody mode="nuevo" customerId={customerId} />

  if (existing.isError) {
    if (existing.error instanceof ApiError && isGone(existing.error.code)) {
      return <GoneScreen label="Clientes" to="/clientes" />
    }
    if (existing.error instanceof NetworkError) {
      return (
        <main className="pantalla">
          <div className="cuerpo">
            <SinConexion />
          </div>
        </main>
      )
    }
    return (
      <main className="pantalla">
        <div className="cuerpo">
          <ErrorGenerico />
        </div>
      </main>
    )
  }

  if (existing.data === undefined) return null

  return <ClienteFormBody mode="editar" customerId={customerId} initial={existing.data} />
}

interface BodyProps {
  mode: 'nuevo' | 'editar'
  customerId: string
  initial?: Customer
}

function ClienteFormBody({ mode, customerId, initial }: BodyProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [name, setName] = useState(initial?.name ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [channel, setChannel] = useState<Channel | null>(initial?.channel ?? null)
  const [vip, setVip] = useState(initial?.vip ?? false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [sending, setSending] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setNameError(null)
    setPhoneError(null)
    setFormError(null)
    setOffline(false)
    setSending(true)
    try {
      const body = { name, phone, channel, vip }
      if (mode === 'nuevo') {
        await registerCustomer(body)
        invalidateResource(queryClient, 'customers')
        navigate('/clientes', { state: { toast: SAVED_TOAST } })
      } else {
        await editCustomer(customerId, body)
        invalidateResource(queryClient, 'customers')
        navigate(`/clientes/${customerId}`, { state: { toast: SAVED_TOAST } })
      }
    } catch (caught) {
      if (caught instanceof ApiError && mode === 'editar' && isGone(caught.code)) {
        invalidateResource(queryClient, 'customers')
        navigate('/clientes', { state: { notice: GONE_NOTICE } })
        return
      }
      if (caught instanceof ApiError) {
        const override = resolveOverride(FIELD_OVERRIDES, caught.code)
        if (override !== undefined) {
          if (override.field === 'name') setNameError(override.message)
          else if (override.field === 'phone') setPhoneError(override.message)
          else setFormError(override.message)
        } else if (caught.code !== 'unknown') {
          setFormError(GENERIC_REFUSAL)
        } else {
          setFormError(ERROR_GENERICO_MENSAJE)
        }
      } else if (caught instanceof NetworkError) {
        setOffline(true)
      } else {
        setFormError(ERROR_GENERICO_MENSAJE)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <span className="encabezado__titulo">
          {mode === 'nuevo' ? 'Nuevo cliente' : 'Editar cliente'}
        </span>
        <form className="formulario" onSubmit={onSubmit}>
          <div className="campo">
            <label className="campo">
              <span className="campo__rotulo">Teléfono</span>
              <input
                className="campo__input"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
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
                value={name}
                onChange={(event) => setName(event.target.value)}
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
                checked={channel === null}
                onChange={() => setChannel(null)}
              />
              Ninguno
            </label>
            <label>
              <input
                type="radio"
                name="channel"
                checked={channel === 'whatsapp'}
                onChange={() => setChannel('whatsapp')}
              />
              WhatsApp
            </label>
            <label>
              <input
                type="radio"
                name="channel"
                checked={channel === 'telegram'}
                onChange={() => setChannel('telegram')}
              />
              Telegram
            </label>
          </fieldset>
          <label className="campo">
            <span className="campo__rotulo">VIP</span>
            <input
              type="checkbox"
              checked={vip}
              onChange={(event) => setVip(event.target.checked)}
            />
          </label>
          {formError !== null && (
            <span className="campo__error" role="alert">
              {formError}
            </span>
          )}
          {offline && <SinConexion />}
          <button className="boton" type="submit" disabled={sending}>
            Guardá y usá
          </button>
        </form>
      </div>
    </main>
  )
}
