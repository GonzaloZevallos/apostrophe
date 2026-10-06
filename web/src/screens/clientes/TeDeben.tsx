/**
 * "Te deben" (`payments.md`, "On screen"): the section on top of Clientes, every
 * customer with a balance above $0, oldest debt first — the API's own order
 * (`GET /payments/debtors`), never resorted here. It is no screen of its own: the old
 * `/clientes/deben` redirects to `/customers` (ADR-0024), so what that screen showed
 * stays reachable here until Clientes' own rebuild.
 */

import { CUSTOMER, pathTo } from '../../routes'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { keys } from '../../api/keys'
import { getDebtors } from '../../api/payments'
import { salesCount } from '../../format/counts'
import { formatDateShort } from '../../format/dates'
import { formatMoney } from '../../format/money'

export default function TeDeben() {
  const { data } = useQuery({
    queryKey: keys.debtors(),
    queryFn: () => getDebtors(),
  })

  // Nothing while it loads, when it fails or when nobody owes: Clientes' own list already
  // shows its loading, its errors and its empty state, and this section is only worth a place
  // above it when somebody owes.
  if (data === undefined || data.debtors.length === 0) return null

  return (
    <section aria-label="Te deben">
      <div>
        <span className="encabezado__titulo">Te deben</span>
      </div>

      <div className="ventas__resumen">
        <span className="cifra-xl">{formatMoney(data.total_owed)}</span>
        <span className="rotulo">{`${salesCount(data.sales_owing_count)} debiendo`}</span>
      </div>

      <div className="lista-clientes">
        {data.debtors.map((debtor) => (
          <Link
            key={debtor.customer.id}
            to={pathTo(CUSTOMER, { id: debtor.customer.id })}
            className="lista-clientes__fila"
          >
            <span className="lista-clientes__nombre">{debtor.customer.name}</span>
            <span className="monto-deuda">{formatMoney(debtor.balance)}</span>
            {debtor.owing_since !== null && (
              <span className="monto-deuda">{`desde ${formatDateShort(debtor.owing_since)}`}</span>
            )}
          </Link>
        ))}
      </div>
    </section>
  )
}
