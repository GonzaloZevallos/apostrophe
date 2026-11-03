/**
 * The "Payment methods" row of Settings → Business: the active names joined by ", " (the seller's
 * data, as written) and their count. Drawn only once the list is read.
 */

import { usePaymentMethods } from '../../api/paymentMethods'
import Icono from '../../components/Icono'
import InAppLink from '../../components/InAppLink'
import { PAYMENT_METHODS_TEXT as T, entryLabel } from '../../copy/paymentMethods'
import { SETTINGS_PAYMENT_METHODS } from '../../routes'

export default function PaymentMethodsEntry() {
  const { data } = usePaymentMethods()
  if (!Array.isArray(data)) return null
  return (
    <InAppLink to={SETTINGS_PAYMENT_METHODS} className="ajustes__item" aria-label={entryLabel(data.length)}>
      <span className="ajustes__item-rotulo">
        {T.entryTitle}
        <span className="medios-pago__resumen">{data.map((method) => method.name).join(', ')}</span>
      </span>
      <span>{data.length}</span>
      <span className="ajustes__item-flecha">
        <Icono nombre="chevron" />
      </span>
    </InAppLink>
  )
}
