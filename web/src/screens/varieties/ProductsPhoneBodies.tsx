/**
 * The phone Products bodies, one per segment (Catalog | Stock), and the notices drawn once above
 * them. Like `ProductsBody`, they read nothing and decide nothing: `Variedades` read the view and
 * `ProductsPhone` picks the body from the segment. The computer keeps the shared `ProductsBody`.
 *
 * The summary, the rows and the empty state wait for ready data and no failure (`showsData`); the
 * actions draw at once. Nothing here shows an empty wording or a digit while the data is held.
 */

import { useTranslation } from 'react-i18next'
import { botonClass } from '../../components/botonVisual'
import ErrorGenerico from '../../components/ErrorGenerico'
import GoneNotice from '../../components/GoneNotice'
import InAppLink from '../../components/InAppLink'
import Loading from '../../components/Loading'
import Notice from '../../components/Notice'
import SinConexion from '../../components/SinConexion'
import { ARCHIVED_VARIETIES, STOCK } from '../../routes'
import { VARIETIES_TEXT } from '../../copy/varieties'
import type { ProductsView } from './ProductsBody'
import ProductsEmpty from './ProductsEmpty'
import ProductsSummary from './ProductsSummary'
import SendCatalog from './SendCatalog'
import StockActions from './StockActions'
import { VarietyRows } from './VarietyRows'

/** True when the summary, the rows and the empty state may draw: the data is in and nothing failed. */
export function showsData(view: ProductsView): boolean {
  return view.failure === null && view.ready
}

/** The notice (or the gone notice), then the failure, then Loading: drawn once, above the body. */
export function ProductsNotices({ view }: { view: ProductsView }) {
  const { feedback, goneExited, failure, ready } = view
  return (
    <>
      {feedback !== null ? <Notice {...feedback} /> : goneExited && <GoneNotice />}
      {failure !== null && (failure === 'network' ? <SinConexion /> : <ErrorGenerico />)}
      {failure === null && !ready && <Loading />}
    </>
  )
}

function Rows({ view }: { view: ProductsView }) {
  if (!showsData(view)) return null
  if (view.rows.length === 0) return <ProductsEmpty />
  return <VarietyRows rows={view.rows} hidden={view.hidden} today={view.today} computer={view.computer} />
}

/**
 * Send catalog, then the rows or the empty state. While `catalogHeld` the block keeps its place
 * as an empty reserved block, so the button does not flip to disabled once `firstRun` answers.
 */
export function CatalogBody({ view, catalogHeld = false }: { view: ProductsView; catalogHeld?: boolean }) {
  return (
    <>
      <div className="variedades__acciones">
        {catalogHeld ? <div className={botonClass('primary')} aria-busy="true" /> : <SendCatalog disabled={view.catalogDisabled} />}
      </div>
      <Rows view={view} />
    </>
  )
}

/** The summary line (a reserved line while loading), the stock actions, the rows, All entries, Archived (N). */
export function StockBody({ view }: { view: ProductsView }) {
  const { t } = useTranslation()
  const loading = view.failure === null && !view.ready
  return (
    <>
      {loading && <p className="pie variedades__resumen">{' '}</p>}
      {showsData(view) && <ProductsSummary summary={view.summary} />}
      <div className="variedades__acciones">
        <StockActions />
      </div>
      <Rows view={view} />
      <InAppLink to={STOCK} className="variedades__todas">
        <span>{t('common:allEntries')}</span>
        <span aria-hidden="true">›</span>
      </InAppLink>
      {!loading && view.archivedCount > 0 && (
        <InAppLink to={ARCHIVED_VARIETIES} className="variedades__todas">
          <span>
            {VARIETIES_TEXT.archivadas}
            {view.archivedCount})
          </span>
          <span aria-hidden="true">›</span>
        </InAppLink>
      )}
    </>
  )
}
