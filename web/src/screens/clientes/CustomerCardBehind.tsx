/**
 * What sits behind the edit-customer sheet on a phone (ADR-0053): the customer's card, from the
 * card's own query keys, so opened from inside the app it is already cached. It draws only from
 * resolved data: while pending and on any error (a gone customer included) it is empty, and the
 * form route shows its own gone handling. It keeps the card's heading, balance, phone and account
 * rows, and draws no chrome, no `h1`, no ids and no control.
 */

import { useQuery } from '@tanstack/react-query'
import { getCustomer } from '../../api/customers'
import { keys } from '../../api/keys'
import { useIsVipCustomers } from '../../api/pricingSettings'
import { getAccount } from '../../api/payments'
import { COMMON_TEXT } from '../../copy/common'
import { CUSTOMERS_TEXT } from '../../copy/customers'
import { formatDateShort } from '../../format/dates'
import { formatMoney, formatMoneyMagnitude } from '../../format/money'
import { formatPhone } from '../../format/phone'
import AccountRowLine from './AccountRowLine'
import { rowKey } from './accountRows'

export default function CustomerCardBehind({ customerId }: { customerId: string }) {
  const vipCustomers = useIsVipCustomers()
  const customer = useQuery({
    queryKey: keys.customer(customerId),
    queryFn: () => getCustomer(customerId),
    retry: false,
  })
  const account = useQuery({
    queryKey: keys.customerAccount(customerId),
    queryFn: () => getAccount(customerId),
    enabled: customer.data !== undefined,
    retry: false,
  })

  const data = customer.data
  if (data === undefined) return null

  return (
    <div className="pantalla">
      <div className="cuerpo">
        <div className="ficha-cliente__encabezado">
          <span className="encabezado__titulo">{data.name}</span>
        </div>
        {data.standing === 'owes' && (
          <div className="ficha-deuda">
            <span className="rotulo ficha-deuda__rotulo">{CUSTOMERS_TEXT.owesYou}</span>
            <span className="cifra-l monto-deuda">{formatMoney(data.balance)}</span>
            {data.owing_since !== null && (
              <span className="rotulo">{CUSTOMERS_TEXT.since}{formatDateShort(data.owing_since)}</span>
            )}
          </div>
        )}
        {data.standing === 'credit' && (
          <div className="ficha-deuda ficha-deuda--credito">
            <span className="rotulo ficha-deuda__rotulo">{CUSTOMERS_TEXT.creditLabel}</span>
            <span className="cifra-l monto-credito">{formatMoneyMagnitude(data.balance)}</span>
          </div>
        )}
        <div className="formulario">
          {data.phone !== null && (
            <div className="campo">
              <span className="campo__rotulo">{CUSTOMERS_TEXT.phone}</span>
              <span>{formatPhone(data.phone)}</span>
            </div>
          )}
          {vipCustomers && (
            <div className="campo">
              <span className="campo__rotulo">{COMMON_TEXT.vip}</span>
              <span>{data.vip ? CUSTOMERS_TEXT.yes : CUSTOMERS_TEXT.off}</span>
            </div>
          )}
        </div>
        {account.data !== undefined && (
          <section className="cuenta-cliente">
            <span className="rotulo cuenta-cliente__encabezado">{CUSTOMERS_TEXT.accountHeading}</span>
            {account.data.rows.map((row) => (
              <AccountRowLine key={rowKey(row)} row={row} />
            ))}
          </section>
        )}
      </div>
    </div>
  )
}
