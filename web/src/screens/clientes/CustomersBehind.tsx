/**
 * What sits behind the new-customer sheet on a phone (ADR-0062): the Customers list, from the
 * list's own query key, so opened from inside the app it is already cached and a direct address
 * costs the one GET the list would have made. It draws only from resolved data: while pending and
 * on any error it is empty, with no skeleton and no wording (the form route keeps its own errors).
 * It keeps the list's heading and the height of its search field, so the page does not shift under
 * the sheet and a scrolled list is held where it was. It draws the same `CustomerSegments` and
 * follows the same `customersView` as the list, with the list's rows: the Owed summary card and the debtor
 * rows on "Owed to you" (nothing when nobody owes, with no empty wording) or every customer on
 * "All". Behind the sheet the control is inert. It draws no chrome, no `h1` and no ids.
 */

import { useQuery } from '@tanstack/react-query'
import { listCustomers } from '../../api/customers'
import { keys } from '../../api/keys'
import { useIsVipCustomers } from '../../api/pricingSettings'
import ClienteFila from './ClienteFila'
import CustomersTitleRow from './CustomersTitleRow'
import OwedSummary from './OwedSummary'
import {
  customersListState,
  customersView,
  listKeyQuery,
  segmentCounts,
  typedQuery,
  useCustomerSearch,
  useDebtors,
} from './CustomerSearch'
import CustomerSegments from './CustomerSegments'

export default function CustomersBehind() {
  const { query, segment } = useCustomerSearch()
  const vipCustomers = useIsVipCustomers()
  // The list's own key: a query of only spaces is the full list's, as on the screen.
  const keyQuery = listKeyQuery(query, query)
  const { data } = useQuery({
    queryKey: keys.customers(keyQuery),
    queryFn: () => listCustomers(keyQuery),
    retry: false,
  })

  const debtors = useDebtors()

  if (data === undefined) return null
  const view = customersView({ query, debtors: debtors.state, segment })
  // It draws only from resolved data, so the read's own flags are settled here: a row is drawn
  // only when the list's one decision says `rows`.
  const listState = customersListState({
    typed: typedQuery(query),
    keyQuery,
    isPending: false,
    isPlaceholderData: false,
    isFetching: false,
    isError: false,
    isEmpty: data.length === 0,
  })
  const owed = view === 'owed' && debtors.data !== null && debtors.data.debtor_count !== 0 ? debtors.data : null

  return (
    <div className="pantalla">
      <div className="cuerpo">
        <CustomersTitleRow avatar={false} />
        <div className="campo">
          <span className="campo__input" />
        </div>
        {view !== 'flat' && (
          <CustomerSegments segment={segment} onChange={() => {}} {...segmentCounts(debtors.data)} />
        )}
        {owed !== null && (
          <section>
            <OwedSummary debtors={owed} />
            <div className="lista-clientes">
              {owed.debtors.map((debtor) => (
                <ClienteFila
                  key={debtor.customer.id}
                  id={debtor.customer.id}
                  name={debtor.customer.name}
                  balance={debtor.balance}
                  owingSince={debtor.owing_since}
                  standing={debtor.standing}
                />
              ))}
            </div>
          </section>
        )}
        {(view === 'flat' || view === 'all') && (
        <section className="clientes__todos">
          <div className="lista-clientes">
            {listState === 'rows' && data.map((customer) => (
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
    </div>
  )
}
