/**
 * `SaleInProgressStrip`: the one button shown over the expense Sheet while the sale under it has
 * at least one Product chosen. It reads "Sale in progress · N products · $total · Back" and is
 * the same move as Close and the system back: it only calls `onBack` (the host's `sheet.close()`).
 * The total is New sale's `totals.total` in the Money format, the figure of its Total row; while
 * the prices are recalculated the amount slot is that row's compact loading bar and the accessible
 * name leaves the amount out.
 */

import Boton from '../../components/Boton'
import Icono from '../../components/Icono'
import Loading from '../../components/Loading'
import { useMoney } from '../../format/moneyContext'

/** The strip's words, handed down by the host that reads the Copy module. */
export interface SaleInProgressWords {
  /** "Sale in progress". */
  saleInProgress: string
  /** "Back". */
  back: string
  /** "N products" for the count of lines with a Product chosen. */
  products: string
  /** The accessible name, from the amount in the Money format, or `null` while it is not known. */
  name: (amount: string | null) => string
}

interface SaleInProgressStripProps {
  words: SaleInProgressWords
  /** New sale's `totals.total`. */
  total: number
  /** Prices are being recalculated: the amount is not known. */
  repricing: boolean
  onBack: () => void
}

export default function SaleInProgressStrip({ words, total, repricing, onBack }: SaleInProgressStripProps) {
  const money = useMoney()
  const amount = repricing ? null : money.money(total)
  return (
    <Boton variant="row" ariaLabel={words.name(amount)} onClick={onBack}>
      <span className="venta-en-curso">
        <Icono nombre="atras" />
        <span className="venta-en-curso__texto">
          {words.saleInProgress} · <b>{words.products}</b> · {repricing ? <Loading compacto /> : amount}
          {' · '}
        </span>
        <span className="venta-en-curso__volver">{words.back}</span>
      </span>
    </Boton>
  )
}
