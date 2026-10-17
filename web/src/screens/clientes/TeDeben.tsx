/**
 * "Te deben" (`payments.md`, "On screen"): the section on top of Clientes. The total, the count
 * line and every customer with a balance above $0 are the API's own answer
 * (`GET /payments/debtors`, oldest owing-since first, ties by name): nothing is sorted, added or
 * compared here, so they equal Inicio's block. With nobody owing it reads a fixed "Nadie te
 * debe", with nothing to tap. It is no screen of its own: the old `/clientes/deben` redirects to
 * `/customers` (ADR-0024).
 */

import { useQuery } from '@tanstack/react-query'
import { keys } from '../../api/keys'
import { getDebtors } from '../../api/payments'
import { salesCount } from '../../format/counts'
import { formatMoney } from '../../format/money'
import ClienteFila from './ClienteFila'
import { NOBODY_OWES } from '../../copy/common'

export default function TeDeben() {
  const { data } = useQuery({
    queryKey: keys.debtors(),
    queryFn: () => getDebtors(),
  })

  // Nothing while it loads or when it fails: Clientes' own list already shows its loading and
  // its errors.
  if (data === undefined) return null

  return (
    <section aria-label="Te deben">
      <div className="campo__rotulo clientes__seccion-cabecera">
        <span>Te deben</span>
        {data.debtors.length > 0 && <span>{`${salesCount(data.sales_owing_count)} debiendo`}</span>}
      </div>

      {data.debtors.length === 0 ? (
        <span className="encabezado__titulo" data-copy="emptyTitle">
          {NOBODY_OWES}
        </span>
      ) : (
        <div className="ventas__resumen">
          <span className="cifra-xl monto-deuda">{formatMoney(data.total_owed)}</span>
        </div>
      )}

      <div className="lista-clientes">
        {data.debtors.map((debtor) => (
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
  )
}
