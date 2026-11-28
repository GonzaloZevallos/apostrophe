/**
 * `SaleDetailCard`: what the Sale held. One row per line in a single shape (quantity, Product
 * name, price, the rule's badge when it is not list, line total), then Shipping charged when there
 * is any, the Total and the Note. It fetches nothing and recomputes nothing: every figure is the
 * recorded one, in the Business's Money format, in its own nowrap element; only the name truncates.
 * Not on any screen yet.
 */

import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { SaleLine } from '../../api/sales'
import ReglaInsignia from '../../components/ReglaInsignia'
import { formatQuantity } from '../../format/money'
import { useMoney } from '../../format/moneyContext'
import './SaleDetailCard.css'

export type SaleDetailCardLine = Pick<
  SaleLine,
  'product_name' | 'quantity' | 'price_per_gram' | 'pricing_rule' | 'customer_type_name' | 'line_total'
>

export interface SaleDetailCardProps {
  lines: SaleDetailCardLine[]
  shipping_charged: number
  total: number
  note: string | null
}

export default function SaleDetailCard({ lines, shipping_charged, total, note }: SaleDetailCardProps) {
  const { t } = useTranslation()
  const money = useMoney()
  const headingId = useId()

  return (
    <section className="sale-detail-card" aria-labelledby={headingId}>
      <h2 id={headingId} className="rotulo">
        {t('sales:detail.heading')}
      </h2>
      <ul className="sale-detail-card__lines">
        {lines.map((line, index) => (
          // Two lines can share a product (a gift line beside a paid one): the position is unique.
          <li key={index} className="sale-detail-card__line">
            <span className="sale-detail-card__figure cifra-n">{formatQuantity(Math.round(Number(line.quantity) * 100))} ×</span>
            <span className="sale-detail-card__name">{line.product_name}</span>
            <span className="sale-detail-card__figure cifra-n">· {money.money(line.price_per_gram)}</span>
            {line.pricing_rule !== 'list' && (
              <ReglaInsignia rule={line.pricing_rule} typeName={line.customer_type_name} />
            )}
            <span className="sale-detail-card__figure sale-detail-card__line-total cifra-s">
              {money.money(line.line_total)}
            </span>
          </li>
        ))}
      </ul>
      <dl className="sale-detail-card__summary">
        {shipping_charged > 0 && (
          <>
            <dt className="rotulo">{t('sales:detail.shipping')}</dt>
            <dd className="sale-detail-card__figure cifra-s">{money.money(shipping_charged)}</dd>
          </>
        )}
        <dt className="rotulo">{t('sales:detail.total')}</dt>
        <dd className="sale-detail-card__figure cifra-xl">{money.money(total)}</dd>
      </dl>
      {note !== null && note.trim() !== '' && <p className="sale-detail-card__note">{note}</p>}
    </section>
  )
}
