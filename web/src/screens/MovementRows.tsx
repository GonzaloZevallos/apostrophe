/**
 * The rows of a variety's "Stock y entradas": a stock entry or a withdrawal that touches the
 * variety, newest first as the API sorts them. A withdrawal row is told by its reason word and
 * a minus sign, never by colour, and opens the withdrawal's detail. Shared by the variety's
 * page (its last 3) and its "Ver todas" page (all of them).
 */

import { Link } from 'react-router'
import type { Movement } from '../api/stock'
import { formatDateShort } from '../format/dates'
import { formatGrams } from '../format/money'
import { withdrawalPath } from '../routes'
import { ORIGIN_LABEL } from '../stock/origin'

const REASON_LABEL = { promotion: 'Promoción', own_use: 'Consumo propio' } as const

export default function MovementRows({ movements }: { movements: Movement[] }) {
  return (
    <div className="historial">
      {movements.map((movement) =>
        movement.kind === 'withdrawal' ? (
          <Link
            key={`withdrawal-${movement.id}`}
            to={withdrawalPath(movement.id)}
            className="historial-fila"
          >
            <span className="historial-fila__fecha">
              {formatDateShort(movement.date)} · {REASON_LABEL[movement.reason]}
            </span>
            <span className="historial-fila__precio">{`−${formatGrams(movement.grams)}`}</span>
          </Link>
        ) : (
          <Link
            key={`entry-${movement.id}`}
            to={`/mi-stock/entradas/${movement.id}`}
            className="historial-fila"
          >
            <span className="historial-fila__fecha">
              {formatDateShort(movement.date)} · {ORIGIN_LABEL[movement.origin]}
            </span>
            <span className="historial-fila__precio">{formatGrams(movement.grams)}</span>
          </Link>
        ),
      )}
    </div>
  )
}
