/**
 * The "Products" group of Settings: a card with one row, Units, that opens the list of the
 * business's units (`docs/product/units.md`, "Settings → Products → Units"). It holds no
 * form, so it is never dirty and never asks before leaving.
 */

import { useTranslation } from 'react-i18next'
import Icono from '../../components/Icono'
import InAppLink from '../../components/InAppLink'
import { SETTINGS_UNITS } from '../../routes'
import SettingsGroup from './SettingsGroup'

export default function ProductsGroup() {
  const { t } = useTranslation()
  return (
    <SettingsGroup title={t('units:productsTitle')} dirty={false}>
      <nav className="ajustes__lista" aria-label={t('units:productsTitle')}>
        <InAppLink to={SETTINGS_UNITS} className="ajustes__item">
          <span className="ajustes__item-rotulo">{t('units:unitsRow')}</span>
          <span className="ajustes__item-flecha">
            <Icono nombre="chevron" />
          </span>
        </InAppLink>
      </nav>
    </SettingsGroup>
  )
}
