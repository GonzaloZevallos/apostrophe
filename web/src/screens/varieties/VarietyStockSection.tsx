/**
 * "Stock y entradas" on a variety's page: its last 3 entries, as `GET /stock` answered them
 * (filtered only by `entriesOf`), and "Ver todas" to its whole list. Read-only: an entry is
 * edited and deleted from that list, through the entry's own form.
 */

import { Link } from 'react-router'
import { type StockView, entriesOf } from '../../api/stock'
import { formatDate } from '../../format/dates'
import { formatGrams, formatMoney } from '../../format/money'
import { VARIETY_ENTRIES } from '../../routes'
import { ORIGIN_LABEL } from '../originLabel'

const LAST = 3

export default function VarietyStockSection({
  stock,
  varietyId,
  today,
}: {
  stock: StockView
  varietyId: number
  today: string
}) {
  const entries = entriesOf(stock, varietyId).slice(0, LAST)
  return (
    <section className="seccion-variedad">
      <div className="seccion-variedad__cabecera">
        <h2 className="seccion-variedad__titulo">Stock y entradas</h2>
        <Link to={VARIETY_ENTRIES(varietyId)}>Ver todas</Link>
      </div>
      <ul className="lista-entradas">
        {entries.map((entry) => (
          <li key={entry.id} className="fila-entrada">
            <span className="fila-entrada__texto">
              <span className="fila-entrada__linea1">
                {formatDate(entry.date, today)} · {ORIGIN_LABEL[entry.origin]}
              </span>
              {entry.cost_per_gram !== null && (
                <span className="fila-entrada__linea2">{formatMoney(entry.cost_per_gram)} el gramo</span>
              )}
            </span>
            <span className="fila-entrada__cifras">
              <span className="fila-entrada__costo">{formatGrams(entry.grams)}</span>
              {entry.total_cost !== null && (
                <span className="fila-entrada__linea2">{formatMoney(entry.total_cost)}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
