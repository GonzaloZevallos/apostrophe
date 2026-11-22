/**
 * `Clientes`: the list, with search by part of the name or of the phone number
 * (`customers.md`). The query lives in the /clientes layout route's context,
 * never in the URL (plan, invariants: "No customer search query ... in a front
 * URL"). Debounced at 150 ms before it becomes the query key
 * (`keys.customers(q)`), so a result that is still catching up to a newer
 * keystroke stays marked `aria-busy` with "Searching…" instead of ever being shown
 * as the answer to the query currently typed (`keepPreviousData`). A dropped
 * network or a server error on the list itself shows the matching state instead
 * of a misleading "no customers yet" (PRD, "Feedback"). Over the list sit the All | Owed to you
 * segments; a typed query, or a debtors read that failed, draws the flat list alone with no
 * segments (`customersView`), and while the debtors read is pending the segments show as a
 * skeleton with nothing below.
 */

import { CUSTOMER, CUSTOMER_NEW } from '../../routes'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useMatch } from 'react-router'
import BotonLink from '../../components/BotonLink'
import SettingsAvatar from '../../components/SettingsAvatar'
import { NetworkError } from '../../api/client'
import { listCustomers } from '../../api/customers'
import { keys } from '../../api/keys'
import { useIsVipCustomers } from '../../api/pricingSettings'
import ErrorGenerico from '../../components/ErrorGenerico'
import { readFeedback } from '../../components/feedback'
import { useGoneNotice } from '../../components/goneExit'
import { owedPlace, useReturnToPlace } from '../../components/useReturnToPlace'
import { GONE_NOTICE } from '../../api/refusals'
import Notice from '../../components/Notice'
import SinConexion from '../../components/SinConexion'
import { customersView, segmentCounts, useCustomerSearch, useDebtors } from './CustomerSearch'
import CustomerSegments from './CustomerSegments'
import { CUSTOMERS_TEXT } from '../../copy/customers'
import { useTranslation } from 'react-i18next'
import { EMPTY_STATE_KEYS } from '../../copy/emptyStates'
import ClienteFila from './ClienteFila'
import TeDeben from './TeDeben'
import { COMMON_TEXT } from '../../copy/common'
import ContentArea from '../../components/ContentArea'
import { LoadingWhile } from '../../components/Loading'

export const SEARCH_LABEL = CUSTOMERS_TEXT.searchCustomer
export const SEARCH_PLACEHOLDER = COMMON_TEXT.phoneOrName
export const SEARCHING = CUSTOMERS_TEXT.searching

/** Where focus lands when the customer's "Collect" is gone: the "Owed to you" block, or the search while it filters. */
function owedOrSearch(root: HTMLElement): HTMLElement | null {
  return owedPlace(root) ?? root.querySelector<HTMLElement>('input[type="text"]')
}

export default function Clientes() {
  const { t } = useTranslation()
  const { query, setQuery, segment, setSegment } = useCustomerSearch()
  const vipCustomers = useIsVipCustomers()
  const [debounced, setDebounced] = useState(query)
  const location = useLocation()
  const besideCard = useMatch(CUSTOMER) !== null
  // Mounted beside a customer's card, the entry's state is the card's (the toast a new customer
  // lands with): the card shows it, so the list never repeats it (GH-288).
  const [stateFeedback] = useState(() => (besideCard ? null : readFeedback(location.state)))
  const goneShown = useGoneNotice()
  const feedback = stateFeedback ?? (goneShown ? { kind: 'notice' as const, refusal: GONE_NOTICE } : null)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 150)
    return () => clearTimeout(id)
  }, [query])

  const { data, isPending, isPlaceholderData, isFetching, isError, error } = useQuery({
    queryKey: keys.customers(debounced),
    queryFn: () => listCustomers(debounced),
    placeholderData: keepPreviousData,
  })

  const customers = data ?? []

  // Back from Record payment the list returns to its place (PM option a). Beside a customer's
  // card the card is where the seller returns to, so the list leaves it to the card.
  const debtors = useDebtors()
  const view = customersView({ query, isPlaceholderData, debtors: debtors.state, segment })
  const answered = debtors.state === 'ready'
  // A read that fails and then answers lands on "Owed to you", whatever was chosen before.
  const previousState = useRef(debtors.state)
  useEffect(() => {
    if (previousState.current === 'failed' && debtors.state === 'ready' && query === '') setSegment('owed')
    previousState.current = debtors.state
  }, [debtors.state, query, setSegment])
  const root = useRef<HTMLElement>(null)
  useReturnToPlace({
    root,
    ready: data !== undefined && !isPlaceholderData && !isFetching && !debtors.fetching,
    owns: !besideCard,
    fallback: owedOrSearch,
  })

  return (
    <ContentArea as="main" className="pantalla" ref={root}>
      {/* The first answer only: a new search over the list already shown is not the area loading. */}
      <LoadingWhile active={isPending || debtors.state === 'pending'} />
      <div className="cuerpo">
        <div className="clientes__encabezado cabecera-fila">
          <span className="encabezado__titulo">{COMMON_TEXT.customers}</span>
          <BotonLink to={CUSTOMER_NEW} variant="secondary" icon="agregar">
            {COMMON_TEXT.newCustomer}
          </BotonLink>
          <SettingsAvatar />
        </div>
        {feedback !== null && <Notice {...feedback} />}
        <label className="campo">
          <span className="visualmente-oculto">{SEARCH_LABEL}</span>
          <input
            className="campo__input"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder={SEARCH_PLACEHOLDER}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {view !== 'flat' && (
          <CustomerSegments segment={segment} onChange={setSegment} {...segmentCounts(debtors.data)} />
        )}
        {view === 'owed' && debtors.data !== null && <TeDeben data={debtors.data} />}
        {isError && error instanceof NetworkError && <SinConexion />}
        {isError && !(error instanceof NetworkError) && <ErrorGenerico />}
        {!isError && (view === 'flat' || (view === 'all' && answered)) && (
          <section className="clientes__todos">
            <div
              className="lista-clientes"
              aria-busy={isPlaceholderData}
              aria-label={isPlaceholderData ? SEARCHING : undefined}
            >
              {isPlaceholderData && <span className="campo__rotulo">{SEARCHING}</span>}
              {!isPlaceholderData && customers.length === 0 && (
                <span className="campo__rotulo" data-copy="emptyTitle">
                  {t(EMPTY_STATE_KEYS.customersList)}
                </span>
              )}
              {customers.map((customer) => (
                <ClienteFila
                  key={customer.id}
                  id={customer.id}
                  name={customer.name}
                  phoneDisplay={customer.phone_display}
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
    </ContentArea>
  )
}
