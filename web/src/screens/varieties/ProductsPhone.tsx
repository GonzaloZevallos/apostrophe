/**
 * The Products phone layout: a title block at the top, then the shared body. The block is a plain
 * div that scrolls with the screen (never a header, never fixed or sticky): the title, nothing
 * for the Publish catalog slot (no element until that action exists), the "New product" action
 * as an icon-only round button named by its words (the row has no room for them), and the
 * Settings avatar. Under it the Catalog | Stock pill row (it scrolls with the content, never sticky),
 * the notices drawn once, and the body of the segment. The "New product" link is the block's alone.
 *
 * This is the only reader of the segment (`readSegment(location.state)`) and its only writer: a
 * pill tap replaces the current entry with `withSegment(location.state, next)` at the same
 * pathname, so no history entry is added. When the segment changes (never on mount) and the title
 * block has scrolled out of view, the new body starts at the top.
 */

import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import BotonLink from '../../components/BotonLink'
import ContentArea from '../../components/ContentArea'
import { PRODUCTS_SEGMENTS } from '../../components/fixedSets'
import Pestanas from '../../components/Pestanas'
import SettingsAvatar from '../../components/SettingsAvatar'
import { VARIETY_NEW } from '../../routes'
import type { ProductsView } from './ProductsBody'
import { CatalogBody, ProductsNotices, StockBody } from './ProductsPhoneBodies'
import { readSegment, withSegment } from './productsSegment'

export default function ProductsPhone({ view }: { view: ProductsView }) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const segment = readSegment(location.state)
  const title = useRef<HTMLDivElement>(null)
  const shown = useRef(segment)
  useEffect(() => {
    if (shown.current === segment) return
    shown.current = segment
    const block = title.current
    if (block !== null && block.getBoundingClientRect().bottom < 0) block.scrollIntoView({ block: 'start' })
  }, [segment])
  return (
    <ContentArea as="main" className="pantalla variedades">
      <div className="cuerpo">
        <div className="productos-cabecera" ref={title}>
          <h1 className="encabezado__titulo">{t('common:varieties')}</h1>
          <BotonLink
            to={VARIETY_NEW}
            variant="icon"
            action="add"
            ariaLabel={t('common:newVariety')}
            className="productos-cabecera__nueva"
          />
          <SettingsAvatar />
        </div>
        <Pestanas
          items={PRODUCTS_SEGMENTS}
          value={segment}
          ajuste="pastilla"
          ariaLabel={t('products:segment.label')}
          onChange={(next) => navigate(location.pathname, { replace: true, state: withSegment(location.state, next) })}
        />
        <ProductsNotices view={view} />
        {segment === 'stock' ? <StockBody view={view} /> : <CatalogBody view={view} />}
      </div>
    </ContentArea>
  )
}
