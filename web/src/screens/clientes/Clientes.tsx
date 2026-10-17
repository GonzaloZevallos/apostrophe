/**
 * `Clientes`: the list, with search by part of the name or of the phone number
 * (`customers.md`). The query lives in the /clientes layout route's context,
 * never in the URL (plan, invariants: "No customer search query ... in a front
 * URL"). Debounced at 150 ms before it becomes the query key
 * (`keys.customers(q)`), so a result that is still catching up to a newer
 * keystroke stays marked `aria-busy` with "Buscando…" instead of ever being shown
 * as the answer to the query currently typed (`keepPreviousData`). A dropped
 * network or a server error on the list itself shows the matching state instead
 * of a misleading "no customers yet" (PRD, "Feedback").
 */

import { CUSTOMER_NEW } from '../../routes'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import BotonLink from '../../components/BotonLink'
import { NetworkError } from '../../api/client'
import { listCustomers } from '../../api/customers'
import { keys } from '../../api/keys'
import { useIsVipCustomers } from '../../api/pricingSettings'
import ErrorGenerico from '../../components/ErrorGenerico'
import { readFeedback } from '../../components/feedback'
import { useGoneNotice } from '../../components/goneExit'
import { GONE_NOTICE } from '../../copy/refusals'
import Notice from '../../components/Notice'
import SinConexion from '../../components/SinConexion'
import { useCustomerSearch } from './CustomerSearch'
import { EMPTY_CUSTOMERS, EVERYONE } from '../../copy/customers'
import ClienteFila from './ClienteFila'
import TeDeben from './TeDeben'

export const SEARCH_LABEL = 'Buscar cliente'
export const SEARCH_PLACEHOLDER = 'Teléfono o nombre'
export const SEARCHING = 'Buscando…'
export default function Clientes() {
  const { query, setQuery } = useCustomerSearch()
  const vipCustomers = useIsVipCustomers()
  const [debounced, setDebounced] = useState(query)
  const location = useLocation()
  const [stateFeedback] = useState(() => readFeedback(location.state))
  const goneShown = useGoneNotice()
  const feedback = stateFeedback ?? (goneShown ? { kind: 'notice' as const, message: GONE_NOTICE } : null)

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

  const customers = data ?? []

  return (
    <main className="pantalla">
      <div className="cuerpo">
        <div>
          <span className="encabezado__titulo">Clientes</span>
        </div>
        <div className="campo__rotulo">
          <span>{`${total.data?.length ?? 0} clientes`}</span>
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
        <div className="clientes__accion">
          <BotonLink to={CUSTOMER_NEW} icon="personaMas">
            Nuevo cliente
          </BotonLink>
        </div>
        {query === '' && <TeDeben />}
        {isError && error instanceof NetworkError && <SinConexion />}
        {isError && !(error instanceof NetworkError) && <ErrorGenerico />}
        {!isError && (
          <section aria-label={query === '' ? EVERYONE : undefined} className="clientes__todos">
            {query === '' && <span className="campo__rotulo">{EVERYONE}</span>}
            <div
              className="lista-clientes"
              aria-busy={isPlaceholderData}
              aria-label={isPlaceholderData ? SEARCHING : undefined}
            >
              {isPlaceholderData && <span className="campo__rotulo">{SEARCHING}</span>}
              {!isPlaceholderData && customers.length === 0 && (
                <span className="campo__rotulo" data-copy="emptyTitle">
                  {EMPTY_CUSTOMERS}
                </span>
              )}
              {customers.map((customer) => (
                <ClienteFila
                  key={customer.id}
                  id={customer.id}
                  name={customer.name}
                  phone={customer.phone}
                  vip={vipCustomers && customer.vip}
                  balance={customer.balance}
                  owingSince={customer.owing_since}
                  standing={customer.standing}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
