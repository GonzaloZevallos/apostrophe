/**
 * One customer's row in Clientes, the same in "Te deben", in everyone A–Z and in search
 * results (`customers.md`, "On screen (Clientes)"). What it says about money comes from the
 * `standing` the API answered, never from comparing a balance here: a customer who owes shows
 * the amount in amber with "owes you since dd/mm" under it and a "Cobrar" button (accessible
 * name "Cobrar a <name>") to Registrar cobro; one in credit shows "A favor $ X" in the
 * neutral treatment; a settled one shows nothing about money. The rest of the row opens the
 * card, and ends in a chevron unless the customer owes (Collect sits there instead). The
 * avatar is decorative, its letters are the name's initials.
 */

import { CUSTOMER, paymentLink, pathTo } from '../../routes'
import BotonLink from '../../components/BotonLink'
import Avatar from '../../components/Avatar'
import Icono from '../../components/Icono'
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

/** The avatar, the name over the number, and the money the row says (nothing for a settled customer). */
function FilaContenido({ name, phone, vip, balance, owingSince, standing }: Required<Omit<Props, 'id'>>) {
  return (
    <>
      <Avatar name={name} />
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
    </>
  )
}

export default function ClienteFila({ id, name, phone = null, vip = false, balance, owingSince, standing }: Props) {
  const computer = useViewport() === 'computer'
  const contenido = { name, phone, vip, balance, owingSince, standing }

  if (standing === 'owes') {
    return (
      <div className="lista-clientes__item">
        <PaneRowLink
          to={pathTo(CUSTOMER, { id })}
          replace={computer}
          className="lista-clientes__fila"
          activeClassName="lista-clientes__fila"
        >
          <FilaContenido {...contenido} />
        </PaneRowLink>
        <BotonLink {...paymentLink(id, 'customers')} icon="cobro" ariaLabel={COMMON_TEXT.collectFrom(name)}>
          {COMMON_TEXT.collect}
        </BotonLink>
      </div>
    )
  }

  return (
    <div className="lista-clientes__item">
      <PaneRowLink
        to={pathTo(CUSTOMER, { id })}
        replace={computer}
        className="lista-clientes__fila"
        activeClassName="lista-clientes__fila"
      >
        <FilaContenido {...contenido} />
        <Icono nombre="chevron" />
      </PaneRowLink>
    </div>
  )
}
