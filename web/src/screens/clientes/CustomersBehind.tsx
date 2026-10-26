/**
 * What sits behind the new-customer sheet on a phone (ADR-0053): the Customers list, from the
 * list's own query key, so opened from inside the app it is already cached and a direct address
 * costs the one GET the list would have made. It draws only from resolved data: while pending and
 * on any error it is empty, with no skeleton and no wording (the form route keeps its own errors).
 * It reuses the list's rows and its "Owed to you" block, and draws no chrome, no `h1` and no ids.
 */

import { useQuery } from '@tanstack/react-query'
import { listCustomers } from '../../api/customers'
import { keys } from '../../api/keys'
import { useIsVipCustomers } from '../../api/pricingSettings'
import { EVERYONE } from '../../copy/customers'
import ClienteFila from './ClienteFila'
import { useCustomerSearch } from './CustomerSearch'
import TeDeben from './TeDeben'

export default function CustomersBehind() {
  const { query } = useCustomerSearch()
  const vipCustomers = useIsVipCustomers()
  const { data } = useQuery({
    queryKey: keys.customers(query),
    queryFn: () => listCustomers(query),
    retry: false,
  })

  if (data === undefined) return null

  return (
    <div className="pantalla">
      <div className="cuerpo">
        {query === '' && <TeDeben />}
        <section className="clientes__todos">
          {query === '' && <span className="campo__rotulo">{EVERYONE}</span>}
          <div className="lista-clientes">
            {data.map((customer) => (
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
      </div>
    </div>
  )
}
