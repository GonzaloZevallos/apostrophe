/**
 * `Variedades` (`Variedades.dc.html`, `VariedadesCompu.dc.html`; `varieties.md`, "The list"):
 * the tab root. Every variety, hidden ones included, sorted by name; each row tells its stock
 * status by shape and word (`MarcaEstado`), "Oculta" beside it when the catalog hides it,
 * grams and days left, and today's list price per gram or "Sin precio: no se puede vender".
 * Above the list: the summary line, "Mandar catálogo" and "+ Entrada de stock"; "Nueva
 * variedad" below them and "Todas las entradas" at the foot.
 *
 * Nothing here decides anything: statuses and days left are `GET /stock`'s, prices are
 * `GET /varieties`', "Oculta" is `GET /catalog`'s own `shown`, and the summary line is counted
 * only by `summaryLine`. A row links to a variety's page by its id alone, never a business id.
 *
 * "Mandar catálogo" is enabled always: the first-run checklist that would disable it while
 * nothing qualifies has no source in the app yet (`navigation.md`, "First-run checklist").
 */

import { useQuery } from '@tanstack/react-query'
import { Link, NavLink, useOutletContext } from 'react-router'
import { NetworkError, get } from '../api/client'
import { catalogQueryOptions } from '../api/catalog'
import { keys } from '../api/keys'
import type { Me } from '../api/me'
import { readStock, type VarietyStock } from '../api/stock'
import ErrorGenerico from '../components/ErrorGenerico'
import Loading from '../components/Loading'
import MarcaEstado from '../components/MarcaEstado'
import SinConexion from '../components/SinConexion'
import { formatGrams, formatMoney } from '../format/money'
import { CATALOG, ENTRIES, ENTRY_NEW, VARIETY, VARIETY_NEW } from '../routes'
import { detailFor } from '../stock/detail'
import { summaryLine } from '../stock/summaryLine'
import { varietiesByName } from './varieties/varietiesByName'

export const VARIETY_SAVED = 'Variedad guardada'
export const NO_PRICE_TODAY = 'Sin precio: no se puede vender'
export const NAME_TAKEN_MESSAGE = 'Ya existe una variedad con ese nombre'
export const NAME_INVALID_MESSAGE = 'Ponele un nombre a la variedad, sin espacios de más'
export const GENERIC_REFUSAL_MESSAGE = 'Revisá los datos e intentá de nuevo.'
export const EMPTY_TITLE = 'Todavía no cargaste ninguna variedad'
export const EMPTY_DETAIL = 'Agregá la primera con su precio para poder vender y mandar tu catálogo.'

interface PriceEntry {
  id: number
  effective_from: string
  list_price: number
  bulk_price: number | null
  bulk_minimum: number | null
}

export interface Variety {
  id: number
  name: string
  archived: boolean
  current_price: PriceEntry | null
}

/** "135 g · 270 días", or the status' own line where there are no days to count ("0 g · Sin
 * gramos desde el 05/10"). */
function figuresOf(row: VarietyStock, today: string): string {
  const grams = formatGrams(row.grams)
  if (row.status === 'sold_out' || row.status === 'no_entries') return `${grams} · ${detailFor(row, today)}`
  return row.days_left === null ? grams : `${grams} · ${row.days_left} días`
}

export default function Variedades() {
  const me = useOutletContext<Me>()
  const varietiesQuery = useQuery({
    queryKey: keys.varieties(),
    queryFn: () => get<Variety[]>('/varieties'),
  })
  const stockQuery = useQuery({ queryKey: keys.stock(), queryFn: readStock })
  const catalogQuery = useQuery(catalogQueryOptions())

  const failure = varietiesQuery.error ?? stockQuery.error
  const ready = varietiesQuery.data !== undefined && stockQuery.data !== undefined
  const hidden = new Set((catalogQuery.data?.varieties ?? []).filter((row) => !row.shown).map((row) => row.id))
  const rows = ready
    ? varietiesByName(varietiesQuery.data).flatMap((variety) => {
        const row = stockQuery.data.varieties.find((candidate) => candidate.variety_id === variety.id)
        return row === undefined ? [] : [{ variety, row }]
      })
    : []
  const summary = ready ? summaryLine(rows.map(({ row }) => row.status)) : null

  return (
    <main className="pantalla variedades">
      <div className="cuerpo">
        <h1 className="encabezado__titulo">Variedades</h1>
        {summary !== null && <p className="pie variedades__resumen">{summary}</p>}
        <div className="variedades__acciones">
          <Link to={CATALOG} className="boton">
            Mandar catálogo
          </Link>
          <Link to={ENTRY_NEW} className="boton boton--suave">
            + Entrada de stock
          </Link>
          <Link to={VARIETY_NEW} className="boton--enlace variedades__nueva">
            Nueva variedad
          </Link>
        </div>
        {failure !== null && (failure instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />)}
        {failure === null && !ready && <Loading />}
        {failure === null && ready && rows.length === 0 && (
          <div className="estado-vacio">
            <span className="estado-vacio__titulo">{EMPTY_TITLE}</span>
            <span className="estado-vacio__detalle">{EMPTY_DETAIL}</span>
          </div>
        )}
        {rows.length > 0 && (
          <div className="lista-variedades">
            {rows.map(({ variety, row }) => (
              <NavLink
                key={variety.id}
                to={VARIETY(variety.id)}
                className={({ isActive }) => (isActive ? 'variedad-fila variedad-fila--activa' : 'variedad-fila')}
              >
                <span className="variedad-fila__encabezado">
                  <MarcaEstado estado={row.status} />
                  <span className="variedad-fila__nombre">{variety.name}</span>
                  {hidden.has(variety.id) && <span className="variedad-fila__oculta">Oculta</span>}
                </span>
                <span className="variedad-fila__pie">
                  <span className="variedad-fila__detalle">{figuresOf(row, me.today)}</span>
                  <span className="variedad-fila__precio">
                    {variety.current_price === null
                      ? NO_PRICE_TODAY
                      : `${formatMoney(variety.current_price.list_price)} x g`}
                  </span>
                </span>
              </NavLink>
            ))}
          </div>
        )}
        <Link to={ENTRIES} className="variedades__todas">
          <span>Todas las entradas</span>
          <span aria-hidden="true">›</span>
        </Link>
      </div>
    </main>
  )
}
