/**
 * `Clientes`: the list, with search by part of the name or of the phone number
 * (`customers.md`). The query lives in the /clientes layout route's context,
 * never in the URL (plan, invariants: "No customer search query ... in a front
 * URL"). Debounced at 150 ms before it becomes the query key
 * (`keys.customers(q)`), so a result that is still catching up to a newer
 * keystroke stays marked `aria-busy` with "Searching…" instead of ever being shown
 * as the answer to the query currently typed (`keepPreviousData`). A dropped
 * network or a server error on the list itself shows the matching state instead
 * of a misleading "no customers yet" (PRD, "Feedback").
 */

import { CUSTOMER, CUSTOMER_NEW } from '../../routes'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useMatch } from 'react-router'
import BotonLink from '../../components/BotonLink'
import { NetworkError } from '../../api/client'
import { listCustomers } from '../../api/customers'
import { debtorsQuery } from '../../api/payments'
import { keys } from '../../api/keys'
import { useIsVipCustomers } from '../../api/pricingSettings'
import ErrorGenerico from '../../components/ErrorGenerico'
import { readFeedback } from '../../components/feedback'
import { useGoneNotice } from '../../components/goneExit'
import { owedPlace, useReturnToPlace } from '../../components/useReturnToPlace'
import { GONE_NOTICE } from '../../api/refusals'
import Notice from '../../components/Notice'
import SinConexion from '../../components/SinConexion'
import { useCustomerSearch } from './CustomerSearch'
import { EMPTY_CUSTOMERS, EVERYONE, CUSTOMERS_TEXT } from '../../copy/customers'
import ClienteFila from './ClienteFila'
import TeDeben from './TeDeben'
import { COMMON_TEXT } from '../../copy/common'

export const SEARCH_LABEL = CUSTOMERS_TEXT.searchCustomer
export const SEARCH_PLACEHOLDER = COMMON_TEXT.phoneOrName
export const SEARCHING = CUSTOMERS_TEXT.searching
/** "1 customer" or "n customers": the plural is two keys. */
const customerCountLine = (count: number): string =>
  count === 1 ? CUSTOMERS_TEXT.oneCustomer : CUSTOMERS_TEXT.customerCount(count)

/** Where focus lands when the customer's "Collect" is gone: the "Owed to you" block, or the search while it filters. */
function owedOrSearch(root: HTMLElement): HTMLElement | null {
  return owedPlace(root) ?? root.querySelector<HTMLElement>('input[type="text"]')
}

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

  const { data, isPlaceholderData, isFetching, isError, error } = useQuery({
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

  // Back from Record payment the list returns to its place (PM option a). Beside a customer's
  // card the card is where the seller returns to, so the list leaves it to the card.
  const debtors = useQuery({ ...debtorsQuery, enabled: query === '' })
  const root = useRef<HTMLElement>(null)
  const besideCard = useMatch(CUSTOMER) !== null
  useReturnToPlace({
    root,
    ready: data !== undefined && !isPlaceholderData && !isFetching && !debtors.isFetching,
    owns: !besideCard,
    fallback: owedOrSearch,
  })

  return (
    <main className="pantalla" ref={root}>
      <div className="cuerpo">
        <div>
          <span className="encabezado__titulo">{COMMON_TEXT.customers}</span>
        </div>
        <div className="campo__rotulo">
          <span>{customerCountLine(total.data?.length ?? 0)}</span>
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
            {COMMON_TEXT.newCustomer}
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
