/** The list's rows: a variety's status, name, "Oculta" when the catalog hides it, figures and price. */

import MarcaEstado from '../../components/MarcaEstado'
import PaneRowLink from '../../components/PaneRowLink'
import { formatGrams } from '../../format/money'
import { useMoney } from '../../format/moneyContext'
import { VARIETY, pathTo } from '../../routes'
import { detailFor, type StockDetailSubject, type StockSideNoteSubject } from '../../stock/detail'
import { VARIETIES_TEXT } from '../../copy/varieties'
import { COMMON_TEXT } from '../../copy/common'
import type { Variety } from '../Variedades'

/** The stock figures a row reads: `VarietyStock` satisfies it. */
export type VarietyFigures = StockDetailSubject & StockSideNoteSubject & { quantity: number }

/** "135 g · 270 días", or the status' own line where there are no days to count ("0 g · Sin
 * gramos desde el 05/10"). */
function figuresOf(row: VarietyFigures, today: string): string {
  const grams = formatGrams(row.quantity)
  if (row.status === 'sold_out' || row.status === 'no_entries') return `${grams} · ${detailFor(row, today)}`
  return row.days_left === null ? grams : VARIETIES_TEXT.n01Dias(grams, row.days_left)
}

export function VarietyRows({
  rows,
  hidden,
  today,
  computer,
}: {
  rows: { variety: Variety; row: VarietyFigures }[]
  hidden: ReadonlySet<number>
  today: string
  computer: boolean
}) {
  const money = useMoney()
  return (
    <div className="lista-variedades">
      {rows.map(({ variety, row }) => (
        <PaneRowLink
          key={variety.id}
          to={pathTo(VARIETY, { id: variety.id })}
          replace={computer}
          className="variedad-fila"
          activeClassName="variedad-fila variedad-fila--activa"
        >
          <span className="variedad-fila__encabezado">
            <MarcaEstado estado={row.status} />
            <span className="variedad-fila__nombre">{variety.name}</span>
            {hidden.has(variety.id) && <span className="variedad-fila__oculta">{VARIETIES_TEXT.oculta}</span>}
          </span>
          <span className="variedad-fila__pie">
            <span className="variedad-fila__detalle cifra-n">{figuresOf(row, today)}</span>
            <span className={variety.current_price === null ? 'variedad-fila__precio' : 'variedad-fila__precio cifra-s'}>
              {variety.current_price === null
                ? VARIETIES_TEXT.sinPrecioNoSe
                : COMMON_TEXT.pricePerGram(money.money(variety.current_price.list_price))}
            </span>
          </span>
        </PaneRowLink>
      ))}
    </div>
  )
}
