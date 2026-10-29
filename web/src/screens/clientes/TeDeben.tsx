/**
 * "Te deben" (`payments.md`, "On screen"): the section on top of Clientes. The total, the count
 * line and every customer with a balance above $0 are the API's own answer
 * (`GET /payments/debtors`, oldest owing-since first, ties by name): nothing is sorted, added or
 * compared here, so they equal Inicio's block. With nobody owing it reads a fixed "Nadie te
 * debe", with nothing to tap. It is no screen of its own: the old `/clientes/deben` redirects to
 * `/customers` (ADR-0024).
 */

import { useQuery } from '@tanstack/react-query'
import { debtorsQuery } from '../../api/payments'
import { salesOwingCount } from '../../format/counts'
import { formatMoney } from '../../format/money'
import { OWED_PLACE } from '../../components/useReturnToPlace'
import ClienteFila from './ClienteFila'
import { useTranslation } from 'react-i18next'
import { EMPTY_STATE_KEYS } from '../../copy/emptyStates'
import { COMMON_TEXT } from '../../copy/common'

export default function TeDeben() {
  const { t } = useTranslation()
  const { data } = useQuery(debtorsQuery)

  // Nothing while it loads or when it fails: Clientes' own list already shows its loading and
  // its errors.
  if (data === undefined) return null

  return (
    <section className="clientes__te-deben" aria-label={COMMON_TEXT.owedToYou}>
      <div className="campo__rotulo clientes__seccion-cabecera">
        <span tabIndex={data.debtors.length > 0 ? -1 : undefined} data-place={data.debtors.length > 0 ? OWED_PLACE : undefined}>
          {COMMON_TEXT.owedToYou}
        </span>
        {data.debtors.length > 0 && <span>{salesOwingCount(data.sales_owing_count)}</span>}
      </div>

      {data.debtors.length === 0 ? (
        <span className="encabezado__titulo" data-copy="emptyTitle" tabIndex={-1} data-place={OWED_PLACE}>
          {t(EMPTY_STATE_KEYS.nobodyOwes)}
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
