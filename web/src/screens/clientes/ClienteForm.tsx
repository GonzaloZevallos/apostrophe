/**
 * The "Nuevo cliente" form (`NuevaVentaCliente.dc.html`), shared by add
 * (`/clientes/nuevo`) and edit (`/clientes/:id/editar`): only the name is required
 * (GH-54, "a customer's phone number is optional"); the phone field stays, and
 * clearing it on edit is just an ordinary save — the form never rewrites `''` to
 * `null` or tests it for emptiness; that is the domain's job alone (invariants).
 * A refusal maps to its field through `refusals.ts`; a phone or name refusal never
 * repeats what was typed —
 * the field simply keeps it and shows the fixed message next to it. Saving an
 * edit that lands on a `gone` id closes the form, refreshes the list and shows
 * `GONE_NOTICE` instead (plan, "Gone records").
 *
 * `ClienteForm` only gates on the existing customer loading before mounting
 * `ClienteFormBody`, so the body's `useState` initializers run once, already with
 * the right values — no effect re-seeds state after a render (oxlint's
 * `set-state-in-effect`).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ApiError, NetworkError, UNKNOWN_CODE } from '../../api/client'
import {
  type Channel,
  type Customer,
  type CustomerIn,
  editCustomer,
  getCustomer,
  registerCustomer,
} from '../../api/customers'
import { invalidateResource, keys } from '../../api/keys'
import { isGone, resolveOverride, type RefusalCode } from '../../api/refusals'
import ErrorGenerico, { ERROR_GENERICO_MENSAJE } from '../../components/ErrorGenerico'
import { gone, toast, type ToastMessage } from '../../components/feedback'
import GoneScreen from '../../components/GoneScreen'
import SinConexion from '../../components/SinConexion'
import CustomerFields from './CustomerFields'
import { paths } from '../../routes/paths'

export const SAVED_TOAST: ToastMessage = 'Cliente guardado'
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
      return <GoneScreen label="Clientes" to={paths.customers()} />
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

  // A plain `useMutation`, so a 401 reaches the shared `MutationCache`'s
  // `onError` (`queryClient.ts`) and triggers the session boundary — clearing
  // the cache and navigating to Entrar — before this component's own `catch`
  // ever sees it. Saving directly with `await registerCustomer(...)` would
  // bypass that cache entirely (open review finding).
  const save = useMutation({
    mutationFn: (body: CustomerIn) =>
      mode === 'nuevo' ? registerCustomer(body) : editCustomer(customerId, body),
  })

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setNameError(null)
    setPhoneError(null)
    setFormError(null)
    setOffline(false)
    try {
      await save.mutateAsync({ name, phone, channel, vip })
      invalidateResource(queryClient, 'customers')
      if (mode === 'nuevo') {
        navigate(paths.customers(), { state: toast(SAVED_TOAST) })
      } else {
        navigate(paths.customer(customerId), { state: toast(SAVED_TOAST) })
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        // The session boundary already cleared the cache and is navigating
        // to Entrar (queryClient.ts's MutationCache.onError); nothing left
        // for this form to show.
        return
      }
      if (caught instanceof ApiError && mode === 'editar' && isGone(caught.code)) {
        invalidateResource(queryClient, 'customers')
        navigate(paths.customers(), { state: gone() })
        return
      }
      if (caught instanceof ApiError) {
        const override = resolveOverride(FIELD_OVERRIDES, caught.code)
        if (override !== undefined) {
          if (override.field === 'name') setNameError(override.message)
          else if (override.field === 'phone') setPhoneError(override.message)
          else setFormError(override.message)
        } else if (caught.code !== UNKNOWN_CODE) {
          setFormError(GENERIC_REFUSAL)
        } else {
          setFormError(ERROR_GENERICO_MENSAJE)
        }
      } else if (caught instanceof NetworkError) {
        setOffline(true)
      } else {
        setFormError(ERROR_GENERICO_MENSAJE)
      }
    }
  }

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <span className="encabezado__titulo">
          {mode === 'nuevo' ? 'Nuevo cliente' : 'Editar cliente'}
        </span>
        <form className="formulario" onSubmit={onSubmit}>
          <CustomerFields
            value={{ name, phone, channel, vip }}
            onChange={(next) => {
              setName(next.name)
              setPhone(next.phone)
              setChannel(next.channel)
              setVip(next.vip)
            }}
            nameError={nameError}
            phoneError={phoneError}
          />
          {formError !== null && (
            <span className="campo__error" role="alert">
              {formError}
            </span>
          )}
          {offline && <SinConexion />}
          <button className="boton" type="submit" disabled={save.isPending}>
            Guardá y usá
          </button>
        </form>
      </div>
    </main>
  )
}
