/**
 * `SelectorPago` (`NuevaVenta.dc.html`): how a sale was paid. The state, Paid · Owing, is a fixed
 * `SegmentedChoice` over `PAYMENT_STATES`; under Paid, and only there, the Payment method is a
 * required Selector (Cash and Transfer, no default, no clearing row) from `usePaymentMethodOptions`.
 *
 * Owing keeps the native `disabled` and its description while the caller says there is no
 * Customer, so the sale form's `toBeDisabled()`/`toBeEnabled()` still read it. The method list
 * opens on the phone as its own history entry, drawn in `listHost` so the form beneath can be
 * `inert` while it is open. This component holds no state: the sale form owns the state and the
 * method, and empties the method when the state leaves Paid.
 */

import { type Ref, useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { PaymentMethod } from '../api/payments'
import { paymentMethodOf, paymentMethodValue, usePaymentMethodOptions } from '../sales/paymentMethods'
import type { PayState } from '../sales/pricing'
import FieldRefusal from './FieldRefusal'
import { PAYMENT_STATES } from './fixedSets'
import SegmentedChoice from './SegmentedChoice'
import Selector from './Selector'
import SinConexion from './SinConexion'

export interface SelectorPagoProps {
  payState: PayState | null
  onPayState: (value: PayState) => void
  method: PaymentMethod | null
  onMethod: (value: PaymentMethod | null) => void
  owingDisabled?: boolean
  owingDescription?: string
  /** Where the phone's method list is drawn, outside the form. */
  listHost?: HTMLElement | null
  /** The seller tried to save under Paid with no method: the field shows its refusal. */
  methodRefused?: boolean
  methodRef?: Ref<HTMLButtonElement>
}

export default function SelectorPago({
  payState,
  onPayState,
  method,
  onMethod,
  owingDisabled = false,
  owingDescription,
  listHost,
  methodRefused = false,
  methodRef,
}: SelectorPagoProps) {
  const { t } = useTranslation()
  const descriptionId = useId()
  const refusalId = useId()
  const methodOptions = usePaymentMethodOptions()
  const showDescription = owingDisabled && owingDescription !== undefined

  return (
    <div>
      <SegmentedChoice
        options={PAYMENT_STATES}
        optionState={{
          owing: { disabled: owingDisabled, describedBy: showDescription ? descriptionId : undefined },
        }}
        value={payState}
        onChange={onPayState}
        ariaLabel={t('common:howPaid')}
      />
      {showDescription && (
        <span id={descriptionId} className="selector-pago__ayuda">
          {owingDescription}
        </span>
      )}
      {payState === 'paid' && (
        <div className="selector-pago__metodo">
          {methodOptions.failure === 'offline' && <SinConexion />}
          {/* A tap on a field whose list failed reads the list again; what was typed stays. */}
          <div onClickCapture={methodOptions.failure === null ? undefined : methodOptions.reload}>
            <Selector
              {...methodOptions.selector}
              label={t('common:paymentMethod')}
              value={paymentMethodValue(method)}
              onChange={(next) => onMethod(paymentMethodOf(next))}
              listHost={listHost}
              fieldRef={methodRef}
              describedBy={methodRefused ? refusalId : undefined}
            />
          </div>
          {methodRefused && <FieldRefusal id={refusalId}>{t('common:chooseHowTheyPaid')}</FieldRefusal>}
        </div>
      )}
    </div>
  )
}
