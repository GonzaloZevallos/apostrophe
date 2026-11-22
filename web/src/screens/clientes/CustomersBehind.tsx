/**
 * What sits behind the new-customer sheet on a phone (ADR-0062): the Customers list, from the
 * list's own query key, so opened from inside the app it is already cached and a direct address
 * costs the one GET the list would have made. It draws only from resolved data: while pending and
 * on any error it is empty, with no skeleton and no wording (the form route keeps its own errors).
 * It keeps the list's heading and the height of its search field, so the page does not shift under
 * the sheet and a scrolled list is held where it was. It draws the same `CustomerSegments` and
 * follows the same `customersView` as the list, with the list's rows: the total and the debtor
 * rows on "Owed to you" (nothing when nobody owes, with no empty wording) or every customer on
 * "All". Behind the sheet the control is inert. It draws no chrome, no `h1` and no ids.
 */

import { useQuery } from '@tanstack/react-query'
import BotonLink from '../../components/BotonLink'
import { CUSTOMER_NEW } from '../../routes'
import { listCustomers } from '../../api/customers'
import { keys } from '../../api/keys'
import { debtorsQuery } from '../../api/payments'
import { useIsVipCustomers } from '../../api/pricingSettings'
import { useMoney } from '../../format/moneyContext'
import { COMMON_TEXT } from '../../copy/common'
import ClienteFila from './ClienteFila'
import { customersView, debtorsState, segmentCounts, useCustomerSearch } from './CustomerSearch'
import CustomerSegments from './CustomerSegments'

export default function CustomersBehind() {
  const money = useMoney()
  const { query, segment } = useCustomerSearch()
  const vipCustomers = useIsVipCustomers()
  const { data } = useQuery({
    queryKey: keys.customers(query),
    queryFn: () => listCustomers(query),
    retry: false,
  })

  const debtors = useQuery(debtorsQuery)

  if (data === undefined) return null
  const view = customersView({ query, isPlaceholderData: false, debtors: debtorsState(debtors), segment })
  const owed = view === 'owed' && debtors.data !== undefined && debtors.data.debtor_count !== 0 ? debtors.data : null

  return (
    <div className="pantalla">
      <div className="cuerpo">
        <div className="clientes__encabezado">
          <span className="encabezado__titulo">{COMMON_TEXT.customers}</span>
          <BotonLink to={CUSTOMER_NEW} variant="secondary" icon="agregar">
            {COMMON_TEXT.newCustomer}
          </BotonLink>
        </div>
        <div className="campo">
          <span className="campo__input" />
        </div>
        {view !== 'flat' && (
          <CustomerSegments segment={segment} onChange={() => {}} {...segmentCounts(debtors.data)} />
        )}
        {owed !== null && (
          <section>
            <div className="ventas__resumen">
              <span className="cifra-xl monto-deuda">{money.money(owed.total_owed)}</span>
            </div>
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
            {data.map((customer) => (
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
