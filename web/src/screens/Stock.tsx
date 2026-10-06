/**
 * `Stock` (`stock.md`, "On screen"): the total grams, every variety's own row — grams,
 * status mark and detail, days left — and the entries, newest first, each linking to
 * `EntradaStock` to edit. Every figure here is the API's own answer (`GET /stock`):
 * `stock_level` computes grams, status and days left server-side (stock-domain), and
 * this screen only maps a status to its fixed Spanish detail line and formats what
 * `GramsOut`/`formatMoney` already carry — it never derives a figure of its own (plan,
 * invariants).
 *
 * A variety's name comes from `GET /varieties` (already used by `Variedades`), joined
 * here by id: `GET /stock` only knows `variety_id`, never a name (CODING_STANDARDS
 * section 9: no business-identifying data travels any other way, and this screen adds
 * no new request surface — it is the same list `Variedades` already reads).
 */

import { STOCK_ENTRY, STOCK_ENTRY_NEW, pathTo } from '../routes'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useOutletContext } from 'react-router'
import { NetworkError } from '../api/client'
import { keys } from '../api/keys'
import type { Me } from '../api/me'
import { type Status, type StockEntry, readStock } from '../api/stock'
import ErrorGenerico from '../components/ErrorGenerico'
import { readFeedback } from '../components/feedback'
import MarcaEstado from '../components/MarcaEstado'
import Notice from '../components/Notice'
import SinConexion from '../components/SinConexion'
import Loading from '../components/Loading'
import { formatDate } from '../format/dates'
import { formatGrams, formatMoney } from '../format/money'
import { detailFor, sideNoteFor } from '../stock/detail'
import type { Variety } from './Variedades'
import { get } from '../api/client'

export const EMPTY_STATE_TITLE = 'Sin entradas de stock'
export const EMPTY_STATE_DETAIL = 'Cargá tu stock inicial o una compra'

const ORIGIN_LABEL: Record<StockEntry['origin'], string> = {
  purchase: 'Compra',
  harvest: 'Cosecha',
  opening_stock: 'Stock inicial',
  adjustment: 'Ajuste',
}

function statusClass(status: Status): string {
  return `fila-stock__insignia fila-stock__insignia--${status}`
}

export default function Stock() {
  const me = useOutletContext<Me>()
  const location = useLocation()
  const feedback = readFeedback(location.state)

  const stockQuery = useQuery({ queryKey: keys.stock(), queryFn: readStock })
  const varietiesQuery = useQuery({
    queryKey: keys.varieties(),
    queryFn: () => get<Variety[]>('/varieties'),
  })

  if (stockQuery.isError) {
    if (stockQuery.error instanceof NetworkError) {
      return (
        <main className="pantalla">
          <div className="cuerpo">
            <SinConexion />
          </div>
        </main>
      )
    }
    return (
      <main className="pantalla">
        <div className="cuerpo">
          <ErrorGenerico />
        </div>
      </main>
    )
  }

  if (stockQuery.data === undefined) {
    return (
      <main className="pantalla">
        <div className="cuerpo">
          <Loading />
        </div>
      </main>
    )
  }

  const stock = stockQuery.data
  const nameOf = (varietyId: number): string => {
    const found = (varietiesQuery.data ?? []).find((variety) => variety.id === varietyId)
    return found?.name ?? ''
  }
  // Nothing has moved: every variety reads `no_entries` (vacuously true with no
  // varieties at all, a fresh business). A variety with sales but no stock entry
  // reads `sold_out`, not `no_entries` (PM round 1), so it keeps its own row instead
  // of being hidden behind this empty state.
  const nothingHasMoved = stock.varieties.every((variety) => variety.status === 'no_entries')

  return (
    <main className="pantalla">
      <div className="cuerpo">
        {feedback !== null && <Notice kind={feedback.kind} message={feedback.message} />}
        <div className="encabezado-fila">
          <span className="encabezado__titulo">Stock</span>
          <span className="pie">{formatGrams(stock.total)} en total</span>
        </div>

        {nothingHasMoved ? (
          <div className="estado-vacio">
            <span className="estado-vacio__titulo">{EMPTY_STATE_TITLE}</span>
            <span className="estado-vacio__detalle">{EMPTY_STATE_DETAIL}</span>
          </div>
        ) : (
          <div className="lista-stock">
            {stock.varieties.map((variety) => (
              <div key={variety.variety_id} className="fila-stock">
                <MarcaEstado estado={variety.status} />
                <span className="fila-stock__texto">
                  <span className="fila-stock__nombre">{nameOf(variety.variety_id)}</span>
                  <span className="fila-stock__detalle">{detailFor(variety, me.today)}</span>
                </span>
                <span className="fila-stock__cifras">
                  <span className="fila-stock__gramos">
                    {variety.status === 'no_entries' ? '—' : formatGrams(variety.grams)}
                  </span>
                  {sideNoteFor(variety) !== null && (
                    <span className={statusClass(variety.status)}>{sideNoteFor(variety)}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        <Link to={STOCK_ENTRY_NEW} className="boton boton--suave">
          Nueva entrada
        </Link>

        <span className="rotulo">Entradas · costo por gramo</span>
        <div className="lista-entradas">
          {stock.entries.map((entry) => (
            <Link key={entry.id} to={pathTo(STOCK_ENTRY, { id: entry.id })} className="fila-entrada">
              <span className="fila-entrada__fecha">{formatDate(entry.date, me.today)}</span>
              <span className="fila-entrada__texto">
                <span className="fila-entrada__linea1">
                  {nameOf(entry.variety_id)} · {formatGrams(entry.grams)}
                </span>
                <span className="fila-entrada__linea2">
                  {ORIGIN_LABEL[entry.origin]}
                  {entry.total_cost !== null ? ` · ${formatMoney(entry.total_cost)}` : ' · sin costo cargado'}
                </span>
              </span>
              <span className="fila-entrada__costo">
                {entry.cost_per_gram !== null ? formatMoney(entry.cost_per_gram) : '—'}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
