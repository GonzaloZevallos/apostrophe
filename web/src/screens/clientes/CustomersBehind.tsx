/**
 * What sits behind the new-customer sheet on a phone (ADR-0053): the Customers list, from the
 * list's own query key, so opened from inside the app it is already cached and a direct address
 * costs the one GET the list would have made. It draws only from resolved data: while pending and
 * on any error it is empty, with no skeleton and no wording (the form route keeps its own errors).
 * It keeps the list's heading and the height of its search field, so the page does not shift under
 * the sheet and a scrolled list is held where it was. It reuses the list's rows and, when somebody owes, its "Owed to you" block; with nobody owing it
 * draws no empty wording. It draws no chrome, no `h1` and no ids.
 */

import { useQuery } from '@tanstack/react-query'
import BotonLink from '../../components/BotonLink'
import { CUSTOMER_NEW } from '../../routes'
import { listCustomers } from '../../api/customers'
import { keys } from '../../api/keys'
import { debtorsQuery } from '../../api/payments'
import { useIsVipCustomers } from '../../api/pricingSettings'
import { salesOwingCount } from '../../format/counts'
import { formatMoney } from '../../format/money'
import { COMMON_TEXT } from '../../copy/common'
import { EVERYONE } from '../../copy/customers'
import ClienteFila from './ClienteFila'
import { useCustomerSearch } from './CustomerSearch'

export default function CustomersBehind() {
  const { query } = useCustomerSearch()
  const vipCustomers = useIsVipCustomers()
  const { data } = useQuery({
    queryKey: keys.customers(query),
    queryFn: () => listCustomers(query),
    retry: false,
  })

  const debtors = useQuery({ ...debtorsQuery, retry: false, enabled: query === '' })

  if (data === undefined) return null
  const owed = debtors.data !== undefined && debtors.data.debtors.length > 0 ? debtors.data : null

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
        {owed !== null && (
          <section>
            <div className="campo__rotulo clientes__seccion-cabecera">
              <span>{COMMON_TEXT.owedToYou}</span>
              <span>{salesOwingCount(owed.sales_owing_count)}</span>
            </div>
            <div className="ventas__resumen">
              <span className="cifra-xl monto-deuda">{formatMoney(owed.total_owed)}</span>
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
