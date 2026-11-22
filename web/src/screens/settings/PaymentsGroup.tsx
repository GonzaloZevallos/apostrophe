/**
 * `PaymentsGroup`, Settings → Payments and expenses (`ConfiguracionCobros.dc.html`, Decision 21):
 * a Configuración group like its siblings (title and "Close"; `routes.test.ts` requires every group to be a form). It holds two rows:
 * "Payment methods", whose subtitle is the offered names joined by ", " (truncated by CSS), and
 * "Expense categories", whose subtitle is the Business's category names in the order the server returns them.
 * Each row sits under its own heading ("Payments", "Expenses"). The Withdrawal reasons row stays in Business (`docs/product/payment-methods.md`).
 */

import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { expenseCategoriesQueryOptions } from '../../api/expenses'
import { paymentMethodsQueryOptions } from '../../api/paymentMethods'
import Icono from '../../components/Icono'
import InAppLink from '../../components/InAppLink'
import { useLoading } from '../../components/useLoading'
import { EXPENSE_CATEGORIES, SETTINGS_PAYMENT_METHODS } from '../../routes'
import SettingsGroup from './SettingsGroup'

export default function PaymentsGroup() {
  const { t } = useTranslation()
  return (
    <SettingsGroup title={t('paymentMethods:group.title')} dirty={false} className="ajustes-cobros">
      <PaymentsRows />
    </SettingsGroup>
  )
}

/** Below the frame's `ContentArea`, so `useLoading` counts on the `<main>` that holds these rows. */
function PaymentsRows() {
  const { t } = useTranslation()
  const methods = useQuery(paymentMethodsQueryOptions())
  const categories = useQuery(expenseCategoriesQueryOptions())
  const names = methods.data?.map((method) => method.name).join(', ')
  const categoryNames = categories.data?.map((category) => category.name).join(', ')

  // The rows can still gain a subtitle until both reads settle; an error settles a read too.
  useLoading(methods.isPending || categories.isPending)

  return (
    <>
      <p className="ajustes-cobros__intro">{t('paymentMethods:group.lead')}</p>
      <nav className="ajustes__lista" aria-label={t('paymentMethods:group.title')} data-menu>
        <section className="ajustes-cobros__seccion">
          <h2 className="ajustes-cobros__encabezado">{t('paymentMethods:group.paymentsHeading')}</h2>
          <div className="ajustes-cobros__tarjeta">
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
          </div>
        </section>
        <section className="ajustes-cobros__seccion">
          <h2 className="ajustes-cobros__encabezado">{t('paymentMethods:group.expensesHeading')}</h2>
          <div className="ajustes-cobros__tarjeta">
            <InAppLink to={EXPENSE_CATEGORIES} className="ajustes__item">
              <span className="ajustes__item-icono">
                <Icono nombre="categorias" />
              </span>
              <span className="ajustes__item-textos">
                <span className="ajustes__item-rotulo">{t('common:expenseCategories')}</span>
                {categoryNames !== undefined && categoryNames !== '' && (
                  <span className="ajustes__item-detalle">{categoryNames}</span>
                )}
              </span>
              <span className="ajustes__item-flecha">
                <Icono nombre="chevron" />
              </span>
            </InAppLink>
          </div>
        </section>
      </nav>
    </>
  )
}
