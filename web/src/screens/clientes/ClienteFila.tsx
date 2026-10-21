/**
 * One customer's row in Clientes, the same in "Te deben", in everyone A–Z and in search
 * results (`customers.md`, "On screen (Clientes)"). What it says about money comes from the
 * `standing` the API answered, never from comparing a balance here: a customer who owes shows
 * the amount in amber with "owes you since dd/mm" under it and a "Cobrar" button (accessible
 * name "Cobrar a <name>") to Registrar cobro; one in credit shows "A favor $ X" in the
 * neutral treatment; a settled one shows nothing about money. The rest of the row opens the
 * card.
 */

import { CUSTOMER, CUSTOMER_PAYMENT, pathTo } from '../../routes'
import BotonLink from '../../components/BotonLink'
import PaneRowLink from '../../components/PaneRowLink'
import type { Standing } from '../../api/payments'
import { formatDateShort } from '../../format/dates'
import { formatPhone } from '../../format/phone'
import { formatMoney, formatMoneyMagnitude } from '../../format/money'
import { useViewport } from '../../shell/useViewport'
import { COMMON_TEXT } from '../../copy/common'
import { CUSTOMERS_TEXT } from '../../copy/customers'

interface Props {
  id: number
  name: string
  /** `GET /payments/debtors` carries no number or VIP mark, so a Te deben row has neither. */
  phone?: string | null
  /** Whether to show the VIP mark: the customer is VIP and Clientes VIP is on. */
  vip?: boolean
  balance: number
  owingSince: string | null
  standing: Standing
}

export default function ClienteFila({ id, name, phone = null, vip = false, balance, owingSince, standing }: Props) {
  const computer = useViewport() === 'computer'

  return (
    <div className="lista-clientes__item">
      <PaneRowLink
        to={pathTo(CUSTOMER, { id })}
        replace={computer}
        className="lista-clientes__fila"
        activeClassName="lista-clientes__fila"
      >
        <span className="lista-clientes__datos">
          <span className="lista-clientes__nombre">
            {name}
            {vip && <span className="vip-insignia">{COMMON_TEXT.vip}</span>}
          </span>
          {phone !== null && <span className="lista-clientes__telefono">{formatPhone(phone)}</span>}
        </span>
        {standing === 'owes' && owingSince !== null && (
          <span className="lista-clientes__balance">
            <span className="monto-deuda">{formatMoney(balance)}</span>
            <span className="monto-deuda">{CUSTOMERS_TEXT.owesYouSince}{formatDateShort(owingSince)}</span>
          </span>
        )}
        {standing === 'credit' && <span className="monto-credito">{CUSTOMERS_TEXT.credit}{formatMoneyMagnitude(balance)}</span>}
      </PaneRowLink>
      {standing === 'owes' && (
        <BotonLink to={pathTo(CUSTOMER_PAYMENT, { id })} icon="cobro" ariaLabel={COMMON_TEXT.collectFrom(name)}>
          {COMMON_TEXT.collect}
        </BotonLink>
      )}
    </div>
  )
}
