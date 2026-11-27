/**
 * `SaleCustomerCard`: who bought the Sale, when and where it stands on being paid. It fetches
 * nothing and works nothing out: the chip decides the payment wording, the date line is exactly
 * `formatWeekdayDay`, and the name is plain text, never a link. With no Customer it draws the person
 * icon in the same circle and, only when `onAssign` is given, an Assign customer button. Not on any
 * screen yet.
 */

import { useTranslation } from 'react-i18next'
import type { Sale } from '../../api/sales'
import Avatar from '../../components/Avatar'
import Boton from '../../components/Boton'
import Icono from '../../components/Icono'
import { formatWeekdayDay } from '../../format/dates'
import SalePaymentChip from './SalePaymentChip'
import './SaleCustomerCard.css'

export interface SaleCustomerCardProps {
  customerName: string | null
  /** The sale's ISO date. */
  date: string
  language: string
  paymentState: Sale['payment_state']
  stillOwed: Sale['still_owed']
  methodName: string | null
  onAssign?: () => void
  assignDisabled: boolean
}

export default function SaleCustomerCard({
  customerName,
  date,
  language,
  paymentState,
  stillOwed,
  methodName,
  onAssign,
  assignDisabled,
}: SaleCustomerCardProps) {
  const { t } = useTranslation()

  return (
    <section className="sale-customer-card">
      {customerName === null ? (
        <span className="avatar" aria-hidden="true">
          <Icono nombre="clientes" />
        </span>
      ) : (
        <Avatar name={customerName} />
      )}
      <div className="sale-customer-card__text">
        <span className="sale-customer-card__name">{customerName ?? t('sales:card.noCustomer')}</span>
        <span className="sale-customer-card__date rotulo">{formatWeekdayDay(date, language)}</span>
      </div>
      <SalePaymentChip state={paymentState} stillOwed={stillOwed} method={methodName} />
      {customerName === null && onAssign !== undefined && (
        <Boton variant="secondary" icon="personaMas" disabled={assignDisabled} onClick={onAssign}>
          {t('sales:detail.assignCustomer')}
        </Boton>
      )}
    </section>
  )
}
