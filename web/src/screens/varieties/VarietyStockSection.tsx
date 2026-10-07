/**
 * "Stock y entradas" on a variety's page: its last 3 movements, the stock entries and the
 * withdrawals that touch it, as `GET /stock/varieties/{id}/movements` answered them (newest
 * first), and "Ver todas" to its whole list. Until that answer arrives the entries
 * `GET /stock` already answered stand in (filtered only by `entriesOf`). A withdrawal row is
 * told apart by its reason word and a minus sign, never by colour, and opens the withdrawal's
 * detail. Read-only: an entry is edited and deleted from the list, through its own form.
 */

import { Link } from 'react-router'
import { type Movement, type StockView, entriesOf } from '../../api/stock'
import { formatDate } from '../../format/dates'
import { formatGrams, formatMoney } from '../../format/money'
import { VARIETY_ENTRIES, withdrawalPath } from '../../routes'
import { ORIGIN_LABEL } from '../originLabel'
import { REASON_LABEL } from '../withdrawals/withdrawalReasons'

const LAST = 3

export default function VarietyStockSection({
  stock,
  movements,
  varietyId,
  today,
}: {
  stock: StockView
  movements: Movement[] | undefined
  varietyId: number
  today: string
}) {
  const rows: Movement[] = (
    movements ?? entriesOf(stock, varietyId).map((entry) => ({ ...entry, kind: 'entry' as const }))
  ).slice(0, LAST)
  return (
    <section className="seccion-variedad">
      <div className="seccion-variedad__cabecera">
        <h2 className="seccion-variedad__titulo">Stock y entradas</h2>
        <Link to={VARIETY_ENTRIES(varietyId)}>Ver todas</Link>
      </div>
      <ul className="lista-entradas">
        {rows.map((movement) =>
          movement.kind === 'withdrawal' ? (
            <li key={`withdrawal-${movement.id}`} className="fila-entrada">
              <Link to={withdrawalPath(movement.id)} className="fila-entrada__enlace">
                <span className="fila-entrada__texto">
                  <span className="fila-entrada__linea1">
                    {formatDate(movement.date, today)} · {REASON_LABEL[movement.reason]}
                  </span>
                </span>
                <span className="fila-entrada__cifras">
                  <span className="fila-entrada__costo">{`−${formatGrams(movement.grams)}`}</span>
                </span>
              </Link>
            </li>
          ) : (
            <li key={`entry-${movement.id}`} className="fila-entrada">
              <span className="fila-entrada__texto">
                <span className="fila-entrada__linea1">
                  {formatDate(movement.date, today)} · {ORIGIN_LABEL[movement.origin]}
                </span>
                {movement.cost_per_gram !== null && (
                  <span className="fila-entrada__linea2">{formatMoney(movement.cost_per_gram)} el gramo</span>
                )}
              </span>
              <span className="fila-entrada__cifras">
                <span className="fila-entrada__costo">{formatGrams(movement.grams)}</span>
                {movement.total_cost !== null && (
                  <span className="fila-entrada__linea2">{formatMoney(movement.total_cost)}</span>
                )}
              </span>
            </li>
          ),
        )}
      </ul>
    </section>
  )
}
