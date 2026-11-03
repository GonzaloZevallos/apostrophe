/**
 * The Archived view of Settings → Business → Payment methods: the plain names, "Restore" on each.
 * A restored method comes back as it was, in its old position. Nothing is labelled "archived"
 * per row: the view's own title already says it.
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { NetworkError } from '../../api/client'
import { invalidateResource } from '../../api/keys'
import { archivedPaymentMethodsQuery, restorePaymentMethod } from '../../api/paymentMethods'
import Boton from '../../components/Boton'
import ErrorGenerico from '../../components/ErrorGenerico'
import Icono from '../../components/Icono'
import { iconOfMethod } from '../../components/paymentMethodIcons'
import SinConexion from '../../components/SinConexion'
import { EMPTY_STATE_KEYS } from '../../copy/emptyStates'
import { PAYMENT_METHODS_TEXT as T, restoreLabel } from '../../copy/paymentMethods'

export default function PaymentMethodsArchived() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const query = useQuery(archivedPaymentMethodsQuery())
  const [failed, setFailed] = useState(false)
  const [sending, setSending] = useState(false)

  async function restore(id: number): Promise<void> {
    setFailed(false)
    setSending(true)
    try {
      await restorePaymentMethod(id)
    } catch {
      setFailed(true)
    } finally {
      setSending(false)
      invalidateResource(queryClient, 'paymentMethods')
    }
  }

  return (
    <main className="pantalla">
      <div className="cuerpo medios-pago">
        <h1 className="encabezado__titulo">{T.archivedTitle}</h1>
        {failed && (
          <span className="campo__error" role="alert">
            {T.restoreFailed}
          </span>
        )}
        {query.isError && (query.error instanceof NetworkError ? <SinConexion /> : <ErrorGenerico />)}
        {query.isPending && (
          <div className="medios-pago__lista" role="progressbar" aria-label={T.loading} aria-busy="true">
            <span className="selector-pago__esqueleto" />
          </div>
        )}
        {query.data?.length === 0 && (
          <div className="estado-vacio">
            <span className="estado-vacio__titulo">{t(EMPTY_STATE_KEYS.archivedMethods)}</span>
          </div>
        )}
        {query.data !== undefined && query.data.length > 0 && (
          <ul className="medios-pago__lista">
            {query.data.map((method) => (
              <li key={method.id} className="medios-pago__fila">
                <span className="medios-pago__nombre">
                  <Icono {...iconOfMethod(method.icon)} />
                  <span className="medios-pago__texto">{method.name}</span>
                </span>
                <Boton
                  variant="secondary"
                  icon="restaurar"
                  disabled={sending}
                  ariaLabel={restoreLabel(method.name)}
                  onClick={() => void restore(method.id)}
                >
                  {T.restore}
                </Boton>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
