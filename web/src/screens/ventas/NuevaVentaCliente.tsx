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
 *
 * The search itself is frozen under `api/keys.ts`'s `saleFormCustomerSearch`
 * (`['sale-form', ...]`, `gcTime: 0`, `staleTime: Infinity`, no refetch on focus or
 * reconnect): its results are where the chosen customer's `vip` comes from, so a
 * result an earlier mount cached — with a since-changed `vip` — can never be the one
 * a seller picks here (plan, invariants: "the one customer object the form holds").
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { ApiError, NetworkError } from '../../api/client'
import { type Customer, type CustomerIn, listCustomers, registerCustomer } from '../../api/customers'
import { keys } from '../../api/keys'
import { useIsVipCustomers } from '../../api/pricingSettings'
import { resolveOverride, type RefusalCode } from '../../api/refusals'
import Boton from '../../components/Boton'
import Icono from '../../components/Icono'
import Loading from '../../components/Loading'
import SinConexion from '../../components/SinConexion'
import { SheetLevel, useSheet } from '../../components/useSheetStack'
import CustomerFields, { type CustomerFieldsValue } from '../clientes/CustomerFields'
import { usePhoneCountryField } from '../clientes/usePhoneCountryField'
import {
  GENERIC_REFUSAL,
  NAME_REQUIRED,
  PHONE_INVALID,
  PHONE_NEEDS_COUNTRY_CODE,
  PHONE_TAKEN,
} from '../clientes/ClienteForm'
import { SALES_TEXT } from '../../copy/sales'
import { COMMON_TEXT } from '../../copy/common'

export interface NuevaVentaClienteProps {
  allowNone: boolean
  onChosen: (customer: Customer | null) => void
}

const EMPTY_NEW_CUSTOMER: CustomerFieldsValue = {
  name: '',
  phone: '',
}

type Field = 'name' | 'phone' | 'form'

const FIELD_OVERRIDES: Partial<Record<RefusalCode, { field: Field; message: string }>> = {
  'customer.name_missing': { field: 'name', message: NAME_REQUIRED },
  'customer.name_too_long': { field: 'name', message: COMMON_TEXT.nameTooLong },
  'customer.phone_invalid': { field: 'phone', message: PHONE_INVALID },
  'customer.phone_needs_country_code': { field: 'phone', message: PHONE_NEEDS_COUNTRY_CODE },
  'customer.phone_taken': { field: 'phone', message: PHONE_TAKEN },
}

export default function NuevaVentaCliente({ allowNone, onChosen }: NuevaVentaClienteProps) {
  // Elegir cliente is the screen's first sheet and Nuevo cliente the second (ADR-0027):
  // both are history entries, so back and "Cerrar" are the same `close()`, and a choice or a
  // saved customer leaves every sheet at once with `closeAll()`.
  const vipCustomers = useIsVipCustomers()
  const chooser = useSheet(1)
  const creator = useSheet(2)
  // The Phone country list is a third sheet: it is drawn in `listHost`, outside the content, and the
  // content beneath is `inert`, so what it covers is reported as covered and unreachable.
  const countryList = useSheet(3)
  const [listHost, setListHost] = useState<HTMLElement | null>(null)
  const [query, setQuery] = useState('')
  const [newCustomer, setNewCustomer] = useState<CustomerFieldsValue>(EMPTY_NEW_CUSTOMER)
  const country = usePhoneCountryField(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [phoneInvalid, setPhoneInvalid] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)

  const results = useQuery({
    queryKey: keys.saleFormCustomerSearch(query),
    queryFn: () => listCustomers(query),
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const create = useMutation({
    mutationFn: (body: CustomerIn) => registerCustomer(body),
  })

  async function onCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setNameError(null)
    setPhoneError(null)
    setPhoneInvalid(false)
    setFormError(null)
    setOffline(false)
    try {
      const customer = await create.mutateAsync({ ...newCustomer, phone_country: country.requestCountry })
      onChosen(customer)
      // Read at call time from the router: a save that resolves after the user already
      // closed the sheets closes nothing more.
      creator.closeAll()
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
          else if (override.field === 'phone') {
            if (caught.code === 'customer.phone_invalid') setPhoneInvalid(true)
            else setPhoneError(override.message)
          } else setFormError(override.message)
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
    <SheetLevel.Provider value={1}>
    <div className="cliente-sheet" role="presentation">
      <div className="cliente-sheet__contenido" inert={countryList.isOpen}>
        <span className="cliente-sheet__manija" aria-hidden="true" />
        <div className="cliente-sheet__encabezado">
          <span className="panel__titulo">{SALES_TEXT.pickCustomer}</span>
          <Boton variant="icon" action="close" ariaLabel={COMMON_TEXT.close} onClick={chooser.close} />
        </div>
        <label className="campo campo--buscar">
          <span className="campo__rotulo visualmente-oculto">{SALES_TEXT.search}</span>
          <span className="campo--buscar__icono">
            <Icono nombre="buscar" />
          </span>
          <input
            className="campo__input campo--buscar__input"
            type="text"
            placeholder={COMMON_TEXT.phoneOrName}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="lista-clientes">
          {results.isPending && <Loading />}
          {(results.data ?? []).map((customer) => (
            <Boton
              key={customer.id}
              variant="row"
              onClick={() => {
                onChosen(customer)
                chooser.closeAll()
              }}
            >
              <span className="lista-clientes__fila-contenido">
                <span className="lista-clientes__nombre">
                  <span className="lista-clientes__nombre-texto">{customer.name}</span>
                  {vipCustomers && customer.vip && <span className="vip-insignia">{COMMON_TEXT.vip}</span>}
                </span>
                {customer.phone_display !== null && (
                  <span className="lista-clientes__telefono">{customer.phone_display}</span>
                )}
              </span>
            </Boton>
          ))}
        </div>
        {allowNone && (
          <Boton
            variant="secondary"
            icon="clientes"
            onClick={() => {
              onChosen(null)
              chooser.closeAll()
            }}
          >
            {SALES_TEXT.noCustomer}
          </Boton>
        )}
        {!creator.isOpen ? (
          <Boton variant="secondary" icon="personaMas" onClick={creator.open}>
            {COMMON_TEXT.newCustomer}
          </Boton>
        ) : (
          <SheetLevel.Provider value={2}>
            <form className="formulario" onSubmit={onCreate}>
              <CustomerFields
                value={newCustomer}
                onChange={setNewCustomer}
                nameError={nameError}
                phoneError={phoneError}
          phoneInvalid={phoneInvalid}
                country={country}
                listHost={listHost}
              />
              {formError !== null && (
                <span className="campo__error" role="alert">
                  {formError}
                </span>
              )}
              {offline && <SinConexion />}
              <Boton textOnly="submit" type="submit" disabled={create.isPending || !country.ready}>
                {SALES_TEXT.createCustomer}
              </Boton>
            </form>
          </SheetLevel.Provider>
        )}
      </div>
      <div className="nueva-venta__lista" ref={setListHost} />
    </div>
    </SheetLevel.Provider>
  )
}
