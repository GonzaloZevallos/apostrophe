/**
 * One line of a customer's account (`ClienteFicha`): the date, what happened, the amount and the
 * running balance. `ClienteFicha` draws it with its delete control as `children`; the card behind
 * a sheet (`CustomerCardBehind`) draws it without one, so the two cannot drift apart.
 */

import type { ReactNode } from 'react'
import type { AccountRow } from '../../api/payments'
import { formatDateShort } from '../../format/dates'
import { type BalanceTone, ledgerRowView } from './accountRows'

/** The balance line's class, by the tone `ledgerRowView` chose: amber only for what is
 * owed, the neutral/blue accent for a credit, plain ink for a settled balance. */
const BALANCE_TONE_CLASS: Record<BalanceTone, string> = {
  debt: 'monto-deuda',
  credit: 'monto-credito',
  neutral: '',
}

export default function AccountRowLine({ row, children }: { row: AccountRow; children?: ReactNode }) {
  const view = ledgerRowView(row)
  return (
    <div className="cuenta-cliente__fila">
      <span className="cuenta-cliente__fecha">{formatDateShort(row.date)}</span>
      <div className="cuenta-cliente__texto">
        <span className="cuenta-cliente__titulo">{view.title}</span>
        <span className="cuenta-cliente__sub">{view.sub}</span>
      </div>
      <div className="cuenta-cliente__cifras">
        <span className="cuenta-cliente__monto cifra-s">{view.own}</span>
        <span className={`cuenta-cliente__saldo cifra-n ${BALANCE_TONE_CLASS[view.balanceTone]}`.trim()}>{view.balance}</span>
      </div>
      {children}
    </div>
  )
}
