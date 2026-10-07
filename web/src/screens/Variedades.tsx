/**
 * `Variedades` (`Variedades.dc.html`, `VariedadesCompu.dc.html`; `varieties.md`, "The list"):
 * the tab root. Every unarchived variety, hidden ones included, sorted by name; each row tells its stock
 * status by shape and word (`MarcaEstado`), "Oculta" beside it when the catalog hides it,
 * grams and days left, and today's list price per gram or "Sin precio: no se puede vender".
 * Above the list: the summary line, "Mandar catálogo" and "+ Entrada de stock" and
 * "Sacar del stock" (the withdrawal form, no variety chosen); "Nueva variedad" below them
 * and "Todas las entradas" and, when there are archived ones, "Archivadas (N)" at the foot.
 *
 * Nothing here decides anything: statuses and days left are `GET /stock`'s, prices are
 * `GET /varieties`', "Oculta" is `GET /catalog`'s own `shown`, and the summary line is counted
 * only by `summaryLine`. A row links to a variety's page by its id alone, never a business id.
 *
 * "Mandar catálogo" is enabled always: the first-run checklist that would disable it while
 * nothing qualifies has no source in the app yet (`navigation.md`, "First-run checklist").
 */

import { useQuery } from '@tanstack/react-query'
import { useLocation, useOutletContext } from 'react-router'
import { NetworkError, get } from '../api/client'
import { catalogQueryOptions } from '../api/catalog'
import { keys } from '../api/keys'
import type { Me } from '../api/me'
import { readStock, type VarietyStock } from '../api/stock'
import BotonLink from '../components/BotonLink'
import ErrorGenerico from '../components/ErrorGenerico'
import GoneNotice from '../components/GoneNotice'
import { useGoneNotice } from '../components/goneExit'
import InAppLink from '../components/InAppLink'
import Loading from '../components/Loading'
import MarcaEstado from '../components/MarcaEstado'
import Notice from '../components/Notice'
import SinConexion from '../components/SinConexion'
import { readFeedback } from '../components/feedback'
import { formatGrams, formatMoney } from '../format/money'
import { ARCHIVED_VARIETIES, CATALOG, STOCK, STOCK_ENTRY_NEW, VARIETY, VARIETY_NEW, WITHDRAWAL_NEW, pathTo } from '../routes'
import { useViewport } from '../shell/useViewport'
import { detailFor } from '../stock/detail'
import { summaryLine } from '../stock/summaryLine'
import { archivedVarietiesQueryOptions } from './varieties/archivedVarieties'
import { varietiesByName } from './varieties/varietiesByName'
import { EMPTY_DETAIL, EMPTY_TITLE } from './varieties/varietiesMessages'
import VarietyRowLink from './varieties/VarietyRowLink'

export const VARIETY_SAVED = 'Variedad guardada'
export const NO_PRICE_TODAY = 'Sin precio: no se puede vender'
export const NAME_TAKEN_MESSAGE = 'Ya existe una variedad con ese nombre'
export const NAME_INVALID_MESSAGE = 'Ponele un nombre a la variedad, sin espacios de más'
export const GENERIC_REFUSAL_MESSAGE = 'Revisá los datos e intentá de nuevo.'

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
  const computer = useViewport() === 'computer'
  const feedback = readFeedback(useLocation().state)
  const goneExited = useGoneNotice()
  const varietiesQuery = useQuery({
    queryKey: keys.varieties(),
    queryFn: () => get<Variety[]>('/varieties'),
  })
  const stockQuery = useQuery({ queryKey: keys.stock(), queryFn: readStock })
  const catalogQuery = useQuery(catalogQueryOptions())
  const archivedCount = useQuery(archivedVarietiesQueryOptions()).data?.length ?? 0

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
          <BotonLink to={CATALOG} icon="telegram">
            Mandar catálogo
          </BotonLink>
          <BotonLink to={STOCK_ENTRY_NEW} variant="secondary" icon="agregar">
            + Entrada de stock
          </BotonLink>
          <BotonLink to={WITHDRAWAL_NEW} variant="secondary" icon="stock">
            Sacar del stock
          </BotonLink>
          <InAppLink to={VARIETY_NEW} className="boton--enlace variedades__nueva">
            Nueva variedad
          </InAppLink>
        </div>
        {feedback !== null ? (
          <Notice kind={feedback.kind} message={feedback.message} />
        ) : (
          goneExited && <GoneNotice />
        )}
        {failure !== null && (failure instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />)}
        {failure === null && !ready && <Loading />}
        {failure === null && ready && rows.length === 0 && (
          <div className="estado-vacio">
            <span className="estado-vacio__titulo" data-copy="emptyTitle">{EMPTY_TITLE}</span>
            <span className="estado-vacio__detalle" data-copy="emptyLine">{EMPTY_DETAIL}</span>
          </div>
        )}
        {rows.length > 0 && (
          <div className="lista-variedades">
            {rows.map(({ variety, row }) => (
              <VarietyRowLink key={variety.id} to={pathTo(VARIETY, { id: variety.id })} replace={computer}>
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
              </VarietyRowLink>
            ))}
          </div>
        )}
        <InAppLink to={STOCK} className="variedades__todas">
          <span>Todas las entradas</span>
          <span aria-hidden="true">›</span>
        </InAppLink>
        {archivedCount > 0 && (
          <InAppLink to={ARCHIVED_VARIETIES} className="variedades__todas">
            <span>Archivadas ({archivedCount})</span>
            <span aria-hidden="true">›</span>
          </InAppLink>
        )}
      </div>
    </main>
  )
}
