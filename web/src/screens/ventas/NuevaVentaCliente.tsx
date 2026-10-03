/**
 * "Elegir cliente" (`NuevaVentaCliente.dc.html`, `sales.md`): a sheet over the sale
 * (the same `.capa`/`.capa__contenido` layer `Gastos.tsx` uses), never a route of its
 * own — closing it only returns to the form it sits on top of; it never discards the
 * sale underneath.
 *
 * Search by phone or part of the name reuses `listCustomers` (`customers.md`'s
 * search); "Sin cliente" is omitted when `allowNone` is false — `assign-customer`'s
 * reuse of this same sheet on `VentaDetalle` never offers it (PM round 4). "Nuevo
 * cliente" embeds `CustomerFields` and creates the customer through the normal
 * `POST /customers`, then hands it straight to `onChosen` — it never navigates (plan,
 * invariants).
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { ApiError, NetworkError } from '../../api/client'
import { type Customer, type CustomerIn, listCustomers, registerCustomer } from '../../api/customers'
import { resolveOverride, type RefusalCode } from '../../api/refusals'
import SinConexion from '../../components/SinConexion'
import CustomerFields, { type CustomerFieldsValue } from '../clientes/CustomerFields'
import {
  GENERIC_REFUSAL,
  NAME_REQUIRED,
  PHONE_INVALID,
  PHONE_TAKEN,
} from '../clientes/ClienteForm'

export interface NuevaVentaClienteProps {
  allowNone: boolean
  onChosen: (customer: Customer | null) => void
  onClose: () => void
}

const EMPTY_NEW_CUSTOMER: CustomerFieldsValue = {
  name: '',
  phone: '',
  channel: null,
  vip: false,
}

type Field = 'name' | 'phone' | 'form'

const FIELD_OVERRIDES: Partial<Record<RefusalCode, { field: Field; message: string }>> = {
  'customer.name_missing': { field: 'name', message: NAME_REQUIRED },
  'customer.name_too_long': { field: 'name', message: 'El nombre es demasiado largo' },
  'customer.phone_invalid': { field: 'phone', message: PHONE_INVALID },
  'customer.phone_taken': { field: 'phone', message: PHONE_TAKEN },
}

export default function NuevaVentaCliente({ allowNone, onChosen, onClose }: NuevaVentaClienteProps) {
  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newCustomer, setNewCustomer] = useState<CustomerFieldsValue>(EMPTY_NEW_CUSTOMER)
  const [nameError, setNameError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)

  const results = useQuery({
    queryKey: ['sale-form', 'customer-search', query],
    queryFn: () => listCustomers(query),
  })

  const create = useMutation({
    mutationFn: (body: CustomerIn) => registerCustomer(body),
  })

  async function onCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setNameError(null)
    setPhoneError(null)
    setFormError(null)
    setOffline(false)
    try {
      const customer = await create.mutateAsync(newCustomer)
      onChosen(customer)
      onClose()
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        // The session boundary already cleared the cache and is navigating to
        // Entrar (queryClient.ts's MutationCache.onError); nothing left to show.
        return
      }
      if (caught instanceof ApiError) {
        const override = resolveOverride(FIELD_OVERRIDES, caught.code)
        if (override !== undefined) {
          if (override.field === 'name') setNameError(override.message)
          else if (override.field === 'phone') setPhoneError(override.message)
          else setFormError(override.message)
        } else {
          setFormError(GENERIC_REFUSAL)
        }
      } else if (caught instanceof NetworkError) {
        setOffline(true)
      } else {
        setFormError(GENERIC_REFUSAL)
      }
    }
  }

  return (
    <div className="capa" role="presentation">
      <div className="capa__contenido">
        <span className="panel__titulo">Elegir cliente</span>
        <label className="campo">
          <span className="campo__rotulo">Buscar</span>
          <input
            className="campo__input"
            type="text"
            placeholder="Teléfono o nombre"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="lista-clientes">
          {(results.data ?? []).map((customer) => (
            <button
              key={customer.id}
              type="button"
              className="lista-clientes__fila"
              onClick={() => {
                onChosen(customer)
                onClose()
              }}
            >
              <span className="lista-clientes__nombre">
                {customer.name}
                {customer.vip && <span className="vip-insignia">VIP</span>}
              </span>
              <span className="lista-clientes__telefono">{customer.phone}</span>
            </button>
          ))}
        </div>
        {allowNone && (
          <button
            type="button"
            className="boton boton--suave"
            onClick={() => {
              onChosen(null)
              onClose()
            }}
          >
            Sin cliente
          </button>
        )}
        {!showCreate ? (
          <button type="button" className="boton-enlace" onClick={() => setShowCreate(true)}>
            Nuevo cliente
          </button>
        ) : (
          <form className="formulario" onSubmit={onCreate}>
            <CustomerFields
              value={newCustomer}
              onChange={setNewCustomer}
              nameError={nameError}
              phoneError={phoneError}
            />
            {formError !== null && (
              <span className="campo__error" role="alert">
                {formError}
              </span>
            )}
            {offline && <SinConexion />}
            <button className="boton" type="submit" disabled={create.isPending}>
              Crear cliente
            </button>
          </form>
        )}
        <button type="button" className="boton-enlace" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  )
}
