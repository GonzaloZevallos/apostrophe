/**
 * The "Owed to you" view of Clientes (`payments.md`, "En pantalla"): the Total owed figure and
 * every customer with a balance above $0 are the API's own answer (`GET /payments/debtors`,
 * oldest owing-since first, ties by name): nothing is sorted, added or compared here, so they
 * equal Inicio's block. With `debtor_count` 0 it reads only the fixed "Nobody owes you", with
 * nothing to tap. Either way its place for focus is marked `OWED_PLACE`. It is no screen of its
 * own: the old `/clientes/deben` redirects to `/customers` (ADR-0024).
 */

import { useQuery } from '@tanstack/react-query'
import { debtorsQuery } from '../../api/payments'
import { useMoney } from '../../format/moneyContext'
import { OWED_PLACE } from '../../components/useReturnToPlace'
import ClienteFila from './ClienteFila'
import { useTranslation } from 'react-i18next'
import { EMPTY_STATE_KEYS } from '../../copy/emptyStates'
import { COMMON_TEXT } from '../../copy/common'

export default function TeDeben() {
  const money = useMoney()
  const { t } = useTranslation()
  const { data } = useQuery(debtorsQuery)

  // Nothing while it loads or when it fails: Clientes' own list already shows its loading and
  // its errors.
  if (data === undefined) return null

  if (data.debtor_count === 0) {
    return (
      <section className="clientes__te-deben" aria-label={COMMON_TEXT.owedToYou}>
        <span className="encabezado__titulo" data-copy="emptyTitle" tabIndex={-1} data-place={OWED_PLACE}>
          {t(EMPTY_STATE_KEYS.nobodyOwes)}
        </span>
      </section>
    )
  }

  return (
    <section className="clientes__te-deben" aria-label={COMMON_TEXT.owedToYou}>
      <div className="ventas__resumen">
        <span className="cifra-xl monto-deuda">{money.money(data.total_owed)}</span>
      </div>

      <div className="lista-clientes" tabIndex={-1} data-place={OWED_PLACE}>
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
