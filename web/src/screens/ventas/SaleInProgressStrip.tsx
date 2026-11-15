/**
 * `SaleInProgressStrip`: the one button shown over the expense Sheet while the sale under it has
 * at least one Product chosen. It reads "Sale in progress · N products · $total · Back" and is
 * the same move as Close and the system back: it only calls `onBack` (the host's `sheet.close()`).
 * The total is New sale's `totals.total` in the Money format, the figure of its Total row; while
 * the prices are recalculated the amount slot is that row's compact loading bar and the accessible
 * name leaves the amount out.
 */

import Icono from '../../components/Icono'
import Loading from '../../components/Loading'
import { SALES_TEXT } from '../../copy/sales'
import { useMoney } from '../../format/moneyContext'

interface SaleInProgressStripProps {
  /** Lines with a Product chosen (`productCount`). */
  n: number
  /** New sale's `totals.total`. */
  total: number
  /** Prices are being recalculated: the amount is not known. */
  repricing: boolean
  onBack: () => void
}

export default function SaleInProgressStrip({ n, total, repricing, onBack }: SaleInProgressStripProps) {
  const money = useMoney()
  const products = SALES_TEXT.products(n)
  const amount = repricing ? null : money.money(total)
  return (
    <button
      type="button"
      className="venta-en-curso"
      aria-label={SALES_TEXT.saleInProgressName(products, amount)}
      onClick={onBack}
    >
      <Icono nombre="atras" />
      <span className="venta-en-curso__texto">
        {SALES_TEXT.saleInProgress} · <b>{products}</b> · {repricing ? <Loading compacto /> : amount}
        {' · '}
      </span>
      <span className="venta-en-curso__volver">{SALES_TEXT.back}</span>
    </button>
  )
}
