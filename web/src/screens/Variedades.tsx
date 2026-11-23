/**
 * `Variedades` (`Variedades.dc.html`, `VariedadesCompu.dc.html`; `varieties.md`, "The list"):
 * the tab root. Every unarchived variety, hidden ones included, sorted by name; each row tells its stock
 * status by shape and word (`MarcaEstado`), "Oculta" beside it when the catalog hides it,
 * grams and days left, and today's list price per gram or "Sin precio: no se puede vender".
 * Above the list: the summary line, "Mandar catálogo" and "+ Entrada de stock" and
 * "Sacar del stock" (the withdrawal form, no variety chosen); "Nueva variedad" below them
 * and "Todas las entradas" and, when there are archived ones, "Archivadas (N)" at the foot.
 * This file reads and decides; `varieties/ProductsComputer` and `varieties/ProductsPhone` draw the body
 * from what it passes, the one `computer` value choosing between them.
 *
 * Nothing here decides anything: statuses and days left are `GET /stock`'s, prices are
 * `GET /api/products`', "Oculta" is `GET /catalog`'s own `shown`, and the summary line is counted
 * only by `summaryLine`. A row links to a variety's page by its id alone, never a business id.
 *
 * "Mandar catálogo" is disabled, with its reason in words, only while `GET /first-run` says the
 * checklist shows and nothing qualifies (`navigation.md`); the server
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
import { readStock } from '../api/stock'
import { useGoneNotice } from '../components/goneExit'
import { readFeedback } from '../components/feedback'
import { useViewport } from '../shell/useViewport'
import { summaryLine } from '../stock/summaryLine'
import { archivedVarietiesQueryOptions } from './varieties/archivedVarieties'
import { varietiesByName } from './varieties/varietiesByName'
import type { ProductsView } from './varieties/ProductsBody'
import ProductsComputer from './varieties/ProductsComputer'
import ProductsPhone from './varieties/ProductsPhone'
import { VARIETIES_TEXT } from '../copy/varieties'
import { GENERIC_REFUSAL_MESSAGE as COPY_GENERIC_REFUSAL_MESSAGE } from '../copy/settings'

export const VARIETY_SAVED = VARIETIES_TEXT.variedadGuardada
export const NO_PRICE_TODAY = VARIETIES_TEXT.sinPrecioNoSe
export const NAME_TAKEN_MESSAGE = VARIETIES_TEXT.yaExisteUnaVariedad
export const NAME_INVALID_MESSAGE = VARIETIES_TEXT.poneleUnNombreA
export const GENERIC_REFUSAL_MESSAGE = COPY_GENERIC_REFUSAL_MESSAGE

interface PriceEntry {
  id: number
  effective_from: string
  list_price: number
  bulk_price: number | null
  bulk_minimum: number | null
  vip_price: number | null
  /** The price each customer type has in this entry; only on the product's current price. */
  type_prices?: TypePrice[]
}

export interface TypePrice {
  customer_type_id: number
  price: number
}

export interface Variety {
  id: number
  name: string
  archived: boolean
  current_price: PriceEntry | null
}

export default function Variedades() {
  const me = useOutletContext<Me>()
  const computer = useViewport() === 'computer'
  const feedback = readFeedback(useLocation().state)
  const goneExited = useGoneNotice()
  const varietiesQuery = useQuery({
    queryKey: keys.varieties(),
    queryFn: () => get<Variety[]>('/api/products'),
  })
  const stockQuery = useQuery({ queryKey: keys.stock(), queryFn: readStock })
  const catalogQuery = useQuery(catalogQueryOptions())
  const firstRun = actionableFirstRun(useQuery(firstRunQuery))
  const catalogDisabled = firstRun?.kind === 'checklist' && firstRun.nothing_qualifies
  const archivedCount = useQuery(archivedVarietiesQueryOptions()).data?.length ?? 0

  const error = varietiesQuery.error ?? stockQuery.error
  const failure = error === null ? null : error instanceof NetworkError ? 'network' : 'other'
  const ready = varietiesQuery.data !== undefined && stockQuery.data !== undefined
  const hidden = new Set((catalogQuery.data?.products ?? []).filter((row) => !row.shown).map((row) => row.product_id))
  const rows = ready
    ? varietiesByName(varietiesQuery.data).flatMap((variety) => {
        const row = stockQuery.data.products.find((candidate) => candidate.product_id === variety.id)
        return row === undefined ? [] : [{ variety, row }]
      })
    : []
  const summary = ready ? summaryLine(rows.map(({ row }) => row.status)) : null

  const view: ProductsView = { rows, hidden, summary, failure, ready, catalogDisabled, archivedCount, feedback, goneExited, today: me.today, computer }
  return computer ? <ProductsComputer view={view} /> : <ProductsPhone view={view} />
}
