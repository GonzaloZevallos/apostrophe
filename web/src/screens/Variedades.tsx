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
 * "Mandar catálogo" is disabled, with its reason in words, only while `GET /first-run` says the
 * checklist shows and nothing qualifies (`navigation.md`, "First-run checklist"); the server
 * decides, the front never counts what the catalog could send. While that read is pending or
 * has failed it is enabled, like in every other state.
 */

import { useQuery } from '@tanstack/react-query'
import { useLocation, useOutletContext } from 'react-router'
import { NetworkError, get } from '../api/client'
import { catalogQueryOptions } from '../api/catalog'
import { actionableFirstRun, firstRunQuery } from '../api/firstRun'
import { keys } from '../api/keys'
import type { Me } from '../api/me'
import { readStock, type VarietyStock } from '../api/stock'
import Boton from '../components/Boton'
import BotonLink from '../components/BotonLink'
import ErrorGenerico from '../components/ErrorGenerico'
import GoneNotice from '../components/GoneNotice'
import { useGoneNotice } from '../components/goneExit'
import InAppLink from '../components/InAppLink'
import Loading from '../components/Loading'
import MarcaEstado from '../components/MarcaEstado'
import Notice from '../components/Notice'
import PaneRowLink from '../components/PaneRowLink'
import SinConexion from '../components/SinConexion'
import { readFeedback } from '../components/feedback'
import { formatGrams, formatMoney } from '../format/money'
import {
  ARCHIVED_VARIETIES,
  CATALOG,
  STOCK,
  STOCK_ENTRY_NEW,
  VARIETY,
  VARIETY_NEW,
  WITHDRAWAL_NEW,
  pathTo,
} from '../routes'
import { useViewport } from '../shell/useViewport'
import { detailFor } from '../stock/detail'
import { summaryLine } from '../stock/summaryLine'
import { archivedVarietiesQueryOptions } from './varieties/archivedVarieties'
import { varietiesByName } from './varieties/varietiesByName'
import { daysLeft } from '../copy/common'
// Kept so the onboarding hook that imports it from here still resolves; the text lives in copy/common.
export { GENERIC_REFUSAL_MESSAGE } from '../copy/common'
import { TAB_VARIETIES } from '../copy/shell'
import { ALL_ENTRIES_TITLE, TAKE_OUT_OF_STOCK } from '../copy/stock'
import {
  CATALOG_DISABLED_REASON,
  EMPTY_DETAIL,
  EMPTY_TITLE,
  HIDDEN,
  NEW_VARIETY,
  NO_PRICE_TODAY,
  SEND_CATALOG,
  STOCK_ENTRY,
  STOCK_ENTRY_ACCESSIBLE_NAME,
  archivedCount as archivedLabel,
  pricePerGram,
} from '../copy/varieties'

const CATALOG_REASON_ID = 'mandar-catalogo-motivo'

const ACTIVE_ROW_CLASS = 'variedad-fila variedad-fila--activa'

interface PriceEntry {
  id: number
  effective_from: string
  list_price: number
  bulk_price: number | null
  bulk_minimum: number | null
  vip_price: number | null
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
  return row.days_left === null ? grams : `${grams} · ${daysLeft(row.days_left)}`
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
  const firstRun = actionableFirstRun(useQuery(firstRunQuery))
  const catalogDisabled = firstRun?.kind === 'checklist' && firstRun.nothing_qualifies
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
        <h1 className="encabezado__titulo">{TAB_VARIETIES}</h1>
        {summary !== null && <p className="pie variedades__resumen">{summary}</p>}
        <div className="variedades__acciones">
          {catalogDisabled ? (
            <>
              <Boton icon="telegram" disabled ariaDescribedBy={CATALOG_REASON_ID}>
                {SEND_CATALOG}
              </Boton>
              <p className="variedades__motivo" id={CATALOG_REASON_ID} data-copy="help">
                {CATALOG_DISABLED_REASON}
              </p>
            </>
          ) : (
            <BotonLink to={CATALOG} icon="telegram">
              {SEND_CATALOG}
            </BotonLink>
          )}
          <BotonLink to={STOCK_ENTRY_NEW} variant="secondary" icon="agregar" ariaLabel={STOCK_ENTRY_ACCESSIBLE_NAME}>
            {STOCK_ENTRY}
          </BotonLink>
          <BotonLink to={WITHDRAWAL_NEW} variant="secondary" icon="salidaStock">
            {TAKE_OUT_OF_STOCK}
          </BotonLink>
          <span className="variedades__nueva">
            <BotonLink to={VARIETY_NEW} variant="link">
              {NEW_VARIETY}
            </BotonLink>
          </span>
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
              <PaneRowLink
                key={variety.id}
                to={pathTo(VARIETY, { id: variety.id })}
                replace={computer}
                className="variedad-fila"
                activeClassName={ACTIVE_ROW_CLASS}
              >
                <span className="variedad-fila__encabezado">
                  <MarcaEstado estado={row.status} />
                  <span className="variedad-fila__nombre">{variety.name}</span>
                  {hidden.has(variety.id) && <span className="variedad-fila__oculta">{HIDDEN}</span>}
                </span>
                <span className="variedad-fila__pie">
                  <span className="variedad-fila__detalle">{figuresOf(row, me.today)}</span>
                  <span className="variedad-fila__precio">
                    {variety.current_price === null
                      ? NO_PRICE_TODAY
                      : pricePerGram(formatMoney(variety.current_price.list_price))}
                  </span>
                </span>
              </PaneRowLink>
            ))}
          </div>
        )}
        <InAppLink to={STOCK} className="variedades__todas">
          <span>{ALL_ENTRIES_TITLE}</span>
          <span aria-hidden="true">›</span>
        </InAppLink>
        {archivedCount > 0 && (
          <InAppLink to={ARCHIVED_VARIETIES} className="variedades__todas">
            <span>{archivedLabel(archivedCount)}</span>
            <span aria-hidden="true">›</span>
          </InAppLink>
        )}
      </div>
    </main>
  )
}
