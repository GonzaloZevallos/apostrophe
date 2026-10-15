/**
 * "Te deben" (`payments.md`, "On screen"): the section on top of Clientes, every
 * customer with a balance above $0, oldest debt first — the API's own order
 * (`GET /payments/debtors`), never resorted here. It is no screen of its own: the old
 * `/clientes/deben` redirects to `/customers` (ADR-0024), so what that screen showed
 * stays reachable here until Clientes' own rebuild.
 */

import { CUSTOMER, CUSTOMER_PAYMENT, pathTo } from '../../routes'
import { useQuery } from '@tanstack/react-query'
import BotonLink from '../../components/BotonLink'
import InAppLink from '../../components/InAppLink'
import { keys } from '../../api/keys'
import { getDebtors } from '../../api/payments'
import { salesCount } from '../../format/counts'
import { formatDateShort } from '../../format/dates'
import { formatMoney } from '../../format/money'
import { NOBODY_OWES } from './messages'

export default function TeDeben() {
  const { data } = useQuery({
    queryKey: keys.debtors(),
    queryFn: () => getDebtors(),
  })

  // Nothing while it loads or when it fails: Clientes' own list already shows its loading and
  // its errors. With nobody owing it keeps its own empty state, "Nadie te debe.".
  if (data === undefined) return null

  return (
    <section aria-label="Te deben">
      <div>
        <span className="encabezado__titulo">Te deben</span>
      </div>

      <div className="ventas__resumen">
        <span className="cifra-xl">{formatMoney(data.total_owed)}</span>
        <span className="rotulo">{`${salesCount(data.sales_owing_count)} debiendo`}</span>
      </div>

      {data.debtors.length === 0 && <span className="campo__rotulo" data-copy="emptyTitle">
          {NOBODY_OWES}
        </span>}

      <div className="lista-clientes">
        {data.debtors.map((debtor) => (
          <div key={debtor.customer.id} className="lista-clientes__item">
            <InAppLink to={pathTo(CUSTOMER, { id: debtor.customer.id })} className="lista-clientes__fila">
              <span className="lista-clientes__nombre">{debtor.customer.name}</span>
              <span className="monto-deuda">{formatMoney(debtor.balance)}</span>
              {debtor.owing_since !== null && (
                <span className="monto-deuda">{`desde ${formatDateShort(debtor.owing_since)}`}</span>
              )}
            </InAppLink>
            <BotonLink
              to={pathTo(CUSTOMER_PAYMENT, { id: debtor.customer.id })}
              icon="cobro"
              ariaLabel={`Cobrar a ${debtor.customer.name}`}
            >
              Cobrar
            </BotonLink>
          </div>
        ))}
      </div>
    </section>
  )
}
