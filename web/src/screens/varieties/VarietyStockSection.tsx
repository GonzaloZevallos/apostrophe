/**
 * "Stock y entradas" on a variety's page: its last 3 movements, the stock entries and the
 * withdrawals that touch it, as `GET /stock/varieties/{id}/movements` answered them (newest
 * first), and "Ver todas" to its whole list. Until that answer arrives the entries
 * `GET /stock` already answered stand in (filtered only by `entriesOf`). A withdrawal row is
 * told apart by its reason word and a minus sign, never by colour, and opens the withdrawal's
 * detail. Read-only: an entry is edited and deleted from the list, through its own form.
 */

import BotonLink from '../../components/BotonLink'
import InAppLink from '../../components/InAppLink'
import { type Movement, type StockView, entriesOf } from '../../api/stock'
import { formatDate } from '../../format/dates'
import { formatGrams, formatMoney } from '../../format/money'
import { VARIETY_ENTRIES, WITHDRAWAL, pathTo } from '../../routes'
import { ORIGIN_LABEL } from '../originLabel'
import { REASON_LABEL } from '../withdrawals/withdrawalReasons'
import { VARIETIES_TEXT } from '../../copy/varieties'
import { OUT_OF_DATE_SEPARATOR } from '../../copy/pinnedCatalog'

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
        <h2 className="seccion-variedad__titulo">{VARIETIES_TEXT.stockYEntradas}</h2>
        <BotonLink variant="link" to={pathTo(VARIETY_ENTRIES, { id: varietyId })}>{VARIETIES_TEXT.verTodas}</BotonLink>
      </div>
      <ul className="lista-entradas">
        {rows.map((movement) =>
          movement.kind === 'withdrawal' ? (
            <li key={`withdrawal-${movement.id}`} className="fila-entrada">
              <InAppLink to={pathTo(WITHDRAWAL, { id: movement.id })} className="fila-entrada__enlace">
                <span className="fila-entrada__texto">
                  <span className="fila-entrada__linea1">
                    {formatDate(movement.date, today)}{OUT_OF_DATE_SEPARATOR}{REASON_LABEL[movement.reason]}
                  </span>
                </span>
                <span className="fila-entrada__cifras">
                  <span className="fila-entrada__costo">{`−${formatGrams(movement.grams)}`}</span>
                </span>
              </InAppLink>
            </li>
          ) : (
            <li key={`entry-${movement.id}`} className="fila-entrada">
              <span className="fila-entrada__texto">
                <span className="fila-entrada__linea1">
                  {formatDate(movement.date, today)}{OUT_OF_DATE_SEPARATOR}{ORIGIN_LABEL[movement.origin]}
                </span>
                {movement.cost_per_gram !== null && (
                  <span className="fila-entrada__linea2">{formatMoney(movement.cost_per_gram)}{VARIETIES_TEXT.elGramo}</span>
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
