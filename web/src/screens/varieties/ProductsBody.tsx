/**
 * The shared Products body (`Variedades.dc.html`, `VariedadesCompu.dc.html`), drawn from what
 * `Variedades` read: the summary line, the actions, the feedback, the list and the foot links.
 * It reads nothing itself and decides nothing; the layout puts the title row above it and the
 * `newProduct` slot at the end of the actions row (`null` when the layout has no such link).
 */

import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import ErrorGenerico from '../../components/ErrorGenerico'
import GoneNotice from '../../components/GoneNotice'
import InAppLink from '../../components/InAppLink'
import Loading from '../../components/Loading'
import Notice from '../../components/Notice'
import type { Feedback } from '../../components/feedback'
import SinConexion from '../../components/SinConexion'
import { ARCHIVED_VARIETIES, STOCK } from '../../routes'
import { VARIETIES_TEXT } from '../../copy/varieties'
import type { Variety } from '../Variedades'
import ProductsEmpty from './ProductsEmpty'
import ProductsSummary from './ProductsSummary'
import SendCatalog from './SendCatalog'
import StockActions from './StockActions'
import { VarietyRows, type VarietyFigures } from './VarietyRows'

export interface ProductsView {
  rows: { variety: Variety; row: VarietyFigures }[]
  hidden: ReadonlySet<number>
  summary: string | null
  /** `network` when the read failed for want of a connection, `other` for any other failure. */
  failure: 'network' | 'other' | null
  ready: boolean
  catalogDisabled: boolean
  archivedCount: number
  feedback: Feedback | null
  goneExited: boolean
  today: string
  computer: boolean
}

export default function ProductsBody({ view, newProduct }: { view: ProductsView; newProduct: ReactNode | null }) {
  const { t } = useTranslation()
  const { rows, hidden, summary, failure, ready, catalogDisabled, archivedCount, feedback, goneExited, today, computer } = view
  return (
    <>
      <ProductsSummary summary={summary} />
      <div className="variedades__acciones">
        <SendCatalog disabled={catalogDisabled} />
        <StockActions />
        {newProduct}
      </div>
      {feedback !== null ? <Notice {...feedback} /> : goneExited && <GoneNotice />}
      {failure !== null && (failure === 'network' ? <SinConexion /> : <ErrorGenerico />)}
      {failure === null && !ready && <Loading />}
      {failure === null && ready && rows.length === 0 && <ProductsEmpty />}
      {rows.length > 0 && <VarietyRows rows={rows} hidden={hidden} today={today} computer={computer} />}
      <InAppLink to={STOCK} className="variedades__todas">
        <span>{t('common:allEntries')}</span>
        <span aria-hidden="true">›</span>
      </InAppLink>
      {archivedCount > 0 && (
        <InAppLink to={ARCHIVED_VARIETIES} className="variedades__todas">
          <span>
            {VARIETIES_TEXT.archivadas}
            {archivedCount})
          </span>
          <span aria-hidden="true">›</span>
        </InAppLink>
      )}
    </>
  )
}
