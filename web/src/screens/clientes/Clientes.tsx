/**
 * `Clientes`: the list, with search by part of the name or of the phone number
 * (`customers.md`). The query lives in the `/clientes` layout route's context,
 * never in the URL (plan, invariants: "No customer search query ... in a front
 * URL"). Debounced at 150 ms before it becomes the query key
 * (`keys.customers(q)`), so a result that is still catching up to a newer
 * keystroke stays marked `aria-busy` with "Buscando…" instead of ever being shown
 * as the answer to the query currently typed (`keepPreviousData`).
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { listCustomers } from '../../api/customers'
import { keys } from '../../api/keys'
import { formatPhone } from '../../format/phone'
import Notice from '../../components/Notice'
import { useCustomerSearch } from './CustomerSearch'

export const SEARCH_LABEL = 'Buscar por teléfono o nombre'
export const SEARCHING = 'Buscando…'
export const EMPTY_LIST = 'Todavía no agregaste ningún cliente.'

interface LocationState {
  toast?: string
  notice?: string
}

export default function Clientes() {
  const { query, setQuery } = useCustomerSearch()
  const [debounced, setDebounced] = useState(query)
  const location = useLocation()
  const [feedback] = useState<LocationState | null>((location.state as LocationState) ?? null)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 150)
    return () => clearTimeout(id)
  }, [query])

  const { data, isPlaceholderData } = useQuery({
    queryKey: keys.customers(debounced),
    queryFn: () => listCustomers(debounced),
    placeholderData: keepPreviousData,
  })

  const customers = data ?? []

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div>
          <span className="encabezado__titulo">Clientes</span>
        </div>
        {feedback?.toast !== undefined && <Notice kind="toast" message={feedback.toast} />}
        {feedback?.notice !== undefined && <Notice kind="notice" message={feedback.notice} />}
        <label className="campo">
          <span className="campo__rotulo">{SEARCH_LABEL}</span>
          <input
            className="campo__input"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <Link className="boton" to="/clientes/nuevo">
          Nuevo cliente
        </Link>
        <div
          className="lista-clientes"
          aria-busy={isPlaceholderData}
          aria-label={isPlaceholderData ? SEARCHING : undefined}
        >
          {isPlaceholderData && <span className="campo__rotulo">{SEARCHING}</span>}
          {!isPlaceholderData && customers.length === 0 && (
            <span className="campo__rotulo">{EMPTY_LIST}</span>
          )}
          {customers.map((customer) => (
            <Link
              key={customer.id}
              to={`/clientes/${customer.id}`}
              className="lista-clientes__fila"
            >
              <span className="lista-clientes__nombre">
                {customer.name}
                {customer.vip && <span className="vip-insignia">VIP</span>}
              </span>
              <span className="lista-clientes__telefono">{formatPhone(customer.phone)}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
