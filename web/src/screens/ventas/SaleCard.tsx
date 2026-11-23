/**
 * `SaleCard`: one Sale in the Sales list, one link to the sale. It reads only the sale's own
 * `payment_state`, `still_owed`, `total`, `lines`, customer name, `id` and `date` (never
 * `still_owing`, the Payments, a VIP flag or the Customer's Balance, and never the clock). The
 * accessible name carries the chip's own sentence from `salePayment.ts`. Not on any screen yet.
 */

import { useTranslation } from 'react-i18next'
import type { Sale } from '../../api/sales'
import InAppLink from '../../components/InAppLink'
import { formatDateShort } from '../../format/dates'
import { formatQuantity } from '../../format/money'
import { useMoney } from '../../format/moneyContext'
import SalePaymentChip from './SalePaymentChip'
import { paymentText, paymentView } from './salePayment'

export interface SaleCardProps {
  sale: Sale
}

export default function SaleCard({ sale }: SaleCardProps) {
  const { t } = useTranslation()
  const money = useMoney()

  const first = sale.lines[0]
  const item =
    first === undefined
      ? ''
      : t('sales:card.item', { name: first.product_name, quantity: formatQuantity(Math.round(first.quantity * 100)) })
  const more = sale.lines.length > 1 ? t('sales:card.more', { count: sale.lines.length - 1 }) : null
  const customer = sale.customer?.name ?? t('sales:card.noCustomer')
  const total = money.money(sale.total)
  const payment = paymentText(t, paymentView(sale.payment_state, sale.still_owed, money))
  const name = t('sales:card.name', { customer, items: more === null ? item : `${item} ${more}`, payment, total })

  return (
    <InAppLink className="sale-card" to={`/sales/${sale.id}`} aria-label={name}>
      <span className="sale-card__name">{customer}</span>
      <span className="sale-card__items">
        <span className="sale-card__item">{item}</span>
        {more !== null && <span className="sale-card__more">{more}</span>}
      </span>
      <span className="sale-card__total cifra-n">{total}</span>
      <SalePaymentChip state={sale.payment_state} stillOwed={sale.still_owed} />
      <span className="sale-card__date">{formatDateShort(sale.date)}</span>
    </InAppLink>
  )
}
