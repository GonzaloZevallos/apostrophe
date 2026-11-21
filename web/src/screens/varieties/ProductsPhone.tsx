/**
 * The Products phone layout: a title block at the top, then the shared body. The block is a plain
 * div that scrolls with the screen (never a header, never fixed or sticky): the title, nothing
 * for the Publish catalog slot (no element until that action exists), the "New product" action
 * as an icon-only round button named by its words (the row has no room for them), and the
 * Settings avatar. The body below it draws no "New product" link: the block owns it.
 */

import { useTranslation } from 'react-i18next'
import BotonLink from '../../components/BotonLink'
import ContentArea from '../../components/ContentArea'
import SettingsAvatar from '../../components/SettingsAvatar'
import { VARIETY_NEW } from '../../routes'
import ProductsBody, { type ProductsView } from './ProductsBody'

export default function ProductsPhone({ view }: { view: ProductsView }) {
  const { t } = useTranslation()
  return (
    <ContentArea as="main" className="pantalla variedades">
      <div className="cuerpo">
        <div className="productos-cabecera">
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
        <ProductsBody view={view} newProduct={null} />
      </div>
    </ContentArea>
  )
}
