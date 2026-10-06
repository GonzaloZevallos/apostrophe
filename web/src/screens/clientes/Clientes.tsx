/**
 * `Clientes`: the list, with search by part of the name or of the phone number
 * (`customers.md`). The query lives in the `/clientes` layout route's context,
 * never in the URL (plan, invariants: "No customer search query ... in a front
 * URL"). Debounced at 150 ms before it becomes the query key
 * (`keys.customers(q)`), so a result that is still catching up to a newer
 * keystroke stays marked `aria-busy` with "Buscando…" instead of ever being shown
 * as the answer to the query currently typed (`keepPreviousData`). A dropped
 * network or a server error on the list itself shows the matching state instead
 * of a misleading "no customers yet" (PRD, "Feedback").
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { NetworkError } from '../../api/client'
import { listCustomers } from '../../api/customers'
import { keys } from '../../api/keys'
import { getDebtors } from '../../api/payments'
import { formatPhone } from '../../format/phone'
import { formatDateShort } from '../../format/dates'
import { formatMoney, formatMoneyMagnitude } from '../../format/money'
import ErrorGenerico from '../../components/ErrorGenerico'
import { readFeedback } from '../../components/feedback'
import Notice from '../../components/Notice'
import SinConexion from '../../components/SinConexion'
import { useCustomerSearch } from './CustomerSearch'
import { paths } from '../../routes/paths'

export const SEARCH_LABEL = 'Buscar cliente'
export const SEARCH_PLACEHOLDER = 'Teléfono o nombre'
export const SEARCHING = 'Buscando…'
export const EMPTY_LIST = 'Todavía no agregaste ningún cliente.'

export default function Clientes() {
  const { query, setQuery } = useCustomerSearch()
  const [debounced, setDebounced] = useState(query)
  const location = useLocation()
  const [feedback] = useState(() => readFeedback(location.state))

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 150)
    return () => clearTimeout(id)
  }, [query])

  const { data, isPlaceholderData, isError, error } = useQuery({
    queryKey: keys.customers(debounced),
    queryFn: () => listCustomers(debounced),
    placeholderData: keepPreviousData,
  })

  // The header's own count comes from the unfiltered list (plan, "Front": "N
  // comes from the unfiltered list"), never from whatever the search box
  // currently narrows the rows below down to.
  const total = useQuery({
    queryKey: keys.customers(''),
    queryFn: () => listCustomers(''),
  })
  const debtors = useQuery({
    queryKey: keys.debtors(),
    queryFn: () => getDebtors(),
  })

  const customers = data ?? []

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div>
          <span className="encabezado__titulo">Clientes</span>
        </div>
        <div className="campo__rotulo">
          <span>{`${total.data?.length ?? 0} clientes`}</span>
          {debtors.data !== undefined && debtors.data.debtors.length > 0 && (
            <>
              {' · '}
              <Link to={paths.customersOwing()}>
                {`${debtors.data.debtors.length} te deben ${formatMoney(debtors.data.total_owed)}`}
              </Link>
            </>
          )}
        </div>
        {feedback !== null && <Notice kind={feedback.kind} message={feedback.message} />}
        <label className="campo">
          <span className="visualmente-oculto">{SEARCH_LABEL}</span>
          <input
            className="campo__input"
            type="text"
            placeholder={SEARCH_PLACEHOLDER}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <Link className="boton" to={paths.newCustomer()}>
          Nuevo cliente
        </Link>
        {isError && error instanceof NetworkError && <SinConexion />}
        {isError && !(error instanceof NetworkError) && <ErrorGenerico />}
        {!isError && (
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
                to={paths.customer(customer.id)}
                className="lista-clientes__fila"
              >
                <span className="lista-clientes__nombre">
                  {customer.name}
                  {customer.vip && <span className="vip-insignia">VIP</span>}
                </span>
                {customer.phone !== null && (
                  <span className="lista-clientes__telefono">{formatPhone(customer.phone)}</span>
                )}
                {customer.standing === 'owes' && customer.owing_since !== null && (
                  <span className="lista-clientes__balance">
                    <span className="monto-deuda">{formatMoney(customer.balance)}</span>
                    <span className="monto-deuda">
                      te debe desde {formatDateShort(customer.owing_since)}
                    </span>
                  </span>
                )}
                {customer.standing === 'credit' && (
                  <span className="monto-credito">A favor {formatMoneyMagnitude(customer.balance)}</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
