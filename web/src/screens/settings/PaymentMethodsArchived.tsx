/**
 * "Archived payment methods" (Settings → Payments and expenses → Payment methods → Archived): the
 * methods no longer offered for new payments, each with Restore. A restored method returns to
 * the list at its own position, with its own name.
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ApiError, NetworkError } from '../../api/client'
import { invalidateResource } from '../../api/keys'
import { archivedPaymentMethodsQueryOptions, restorePaymentMethod } from '../../api/paymentMethods'
import { isGone } from '../../api/refusals'
import Boton from '../../components/Boton'
import GoneNotice from '../../components/GoneNotice'
import Loading from '../../components/Loading'
import PaymentMethodGlyph from '../../components/PaymentMethodGlyph'
import SinConexion from '../../components/SinConexion'
import { EMPTY_STATE_KEYS } from '../../copy/emptyStates'
import SettingsGroup from './SettingsGroup'

export default function PaymentMethodsArchived() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const list = useQuery(archivedPaymentMethodsQueryOptions())
  const [gone, setGone] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)

  async function restore(id: number): Promise<void> {
    setGone(false)
    setFailure(null)
    setOffline(false)
    try {
      await restorePaymentMethod(id)
      invalidateResource(queryClient, 'paymentMethods')
    } catch (caught) {
      if (caught instanceof NetworkError) setOffline(true)
      else if (caught instanceof ApiError && isGone(caught.code)) {
        invalidateResource(queryClient, 'paymentMethods')
        setGone(true)
      } else setFailure(t('common:genericError'))
    }
  }

  return (
    <SettingsGroup title={t('paymentMethods:archived.title')} dirty={false}>
      <>
        {list.isPending && <Loading />}
        {list.isError &&
          (list.error instanceof NetworkError ? (
            <SinConexion />
          ) : (
            <>
              <span className="campo__error" role="alert">
                {t('paymentMethods:list.loadError')}
              </span>
              <Boton variant="link" onClick={() => void list.refetch()}>
                {t('paymentMethods:list.retry')}
              </Boton>
            </>
          ))}
        {list.data !== undefined && list.data.length === 0 && (
          <span className="campo__rotulo">{t(EMPTY_STATE_KEYS.paymentMethodsArchived)}</span>
        )}
        {list.data !== undefined && (
          <ul className="ajustes__lista">
            {list.data.map((method) => (
              <li key={method.id} className="medio-pago-fila">
                <span className="medio-pago-fila__nombre">
                  <PaymentMethodGlyph icon={method.icon} />
                  {method.name}
                </span>
                <Boton
                  variant="secondary"
                  icon="restaurar"
                  ariaLabel={t('paymentMethods:archived.restoreNamed', { name: method.name })}
                  onClick={() => void restore(method.id)}
                >
                  {t('paymentMethods:archived.restore')}
                </Boton>
              </li>
            ))}
          </ul>
        )}
        {failure !== null && (
          <span className="campo__error" role="alert">
            {failure}
          </span>
        )}
        {offline && <SinConexion />}
        {gone && <GoneNotice />}
      </>
    </SettingsGroup>
  )
}
