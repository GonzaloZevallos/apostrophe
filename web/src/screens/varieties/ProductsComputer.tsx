/**
 * The Products computer layout (`VariedadesCompu.dc.html`): the title row and the shared body.
 */

import { useTranslation } from 'react-i18next'
import BotonLink from '../../components/BotonLink'
import ContentArea from '../../components/ContentArea'
import SettingsAvatar from '../../components/SettingsAvatar'
import { VARIETY_NEW } from '../../routes'
import ProductsBody, { type ProductsView } from './ProductsBody'

export default function ProductsComputer({ view }: { view: ProductsView }) {
  const { t } = useTranslation()
  return (
    <ContentArea as="main" className="pantalla variedades">
      <div className="cuerpo">
        <div className="cabecera-fila cabecera-fila--envoltura">
          <h1 className="encabezado__titulo">{t('common:varieties')}</h1>
          <SettingsAvatar />
        </div>
        <ProductsBody
          view={view}
          newProduct={
            <span className="variedades__nueva">
              <BotonLink to={VARIETY_NEW} variant="link">
                {t('common:newVariety')}
              </BotonLink>
            </span>
          }
        />
      </div>
    </ContentArea>
  )
}
