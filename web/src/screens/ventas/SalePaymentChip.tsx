/**
 * `SalePaymentChip`: where one Sale stands on being paid, read only from `payment_state` and
 * `still_owed` (never `still_owing`, the Payments or the Customer's Balance). The word says the
 * state; part-paid adds a half-filled circle and the unknown line the Attention icon, both
 * decorative. A state or amount that cannot be shown reads "Payment can't be shown", never a
 * guessed state or a $ 0. The decision and the sentence live in `salePayment.ts`, shared with the
 * Sale card's accessible name. Not on any screen yet.
 */

import { useTranslation } from 'react-i18next'
import type { Sale } from '../../api/sales'
import Icono from '../../components/Icono'
import { useMoney } from '../../format/moneyContext'
import { paymentText, paymentView } from './salePayment'

export interface SalePaymentChipProps {
  state: Sale['payment_state']
  stillOwed: Sale['still_owed']
}

/** Stands in for the amount while the sentence is split around it (a private-use character no
 * text holds), so the figure can sit in its own element. */
const AMOUNT_MARK = '\uE000'

export default function SalePaymentChip({ state, stillOwed }: SalePaymentChipProps) {
  const { t } = useTranslation()
  const money = useMoney()
  const view = paymentView(state, stillOwed, money)

  switch (view.variant) {
    case 'paid':
      return <span className="payment-chip rotulo payment-chip--paid">{paymentText(t, view)}</span>
    case 'unpaid':
      return <span className="payment-chip rotulo payment-chip--unpaid">{paymentText(t, view)}</span>
    case 'part_paid': {
      const parts = paymentText(t, { ...view, amount: AMOUNT_MARK }).split(AMOUNT_MARK)
      const [before, after] = parts
      return (
        <span className="payment-chip rotulo payment-chip--part-paid">
          <span className="payment-chip__half" aria-hidden="true" />
          {parts.length === 2 ? (
            <span>
              {before}
              <span className="cifra-n">{view.amount}</span>
              {after}
            </span>
          ) : (
            paymentText(t, view)
          )}
        </span>
      )
    }
    case 'unknown':
      return (
        <span className="payment-chip rotulo payment-chip--unknown">
          <Icono nombre="atencion" />
          {paymentText(t, view)}
        </span>
      )
  }
}
