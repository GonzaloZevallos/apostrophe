/**
 * `PaymentsGroup`, Settings → Payments and expenses (`ConfiguracionCobros.dc.html`, Decision 21):
 * a Configuración group like its siblings (title and "Close"; `routes.test.ts` requires every group to be a form). It holds one row today, "Payment methods",
 * whose subtitle is the offered names joined by ", " (truncated by CSS). The Expense categories
 * and Withdrawal reasons rows stay where they are (`docs/product/payment-methods.md`).
 */

import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { paymentMethodsQueryOptions } from '../../api/paymentMethods'
import Icono from '../../components/Icono'
import InAppLink from '../../components/InAppLink'
import { SETTINGS_PAYMENT_METHODS } from '../../routes'
import SettingsGroup from './SettingsGroup'

export default function PaymentsGroup() {
  const { t } = useTranslation()
  const methods = useQuery(paymentMethodsQueryOptions())
  const names = methods.data?.map((method) => method.name).join(', ')

  return (
    <SettingsGroup title={t('paymentMethods:group.title')} dirty={false}>
        <nav className="ajustes__lista" aria-label={t('paymentMethods:group.title')} data-menu>
          <InAppLink to={SETTINGS_PAYMENT_METHODS} className="ajustes__item">
            <span className="ajustes__item-icono">
              <Icono nombre="tarjeta" />
            </span>
            <span className="ajustes__item-textos">
              <span className="ajustes__item-rotulo">{t('paymentMethods:group.row')}</span>
              {names !== undefined && <span className="ajustes__item-detalle">{names}</span>}
            </span>
            <span className="ajustes__item-flecha">
              <Icono nombre="chevron" />
            </span>
          </InAppLink>
        </nav>
    </SettingsGroup>
  )
}
