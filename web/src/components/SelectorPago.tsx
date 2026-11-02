/**
 * `SelectorPago`: how a sale or a payment was paid. A `role="radiogroup"` named "Payment
 * method" with one `role="radio"` chip per active payment method of the business, in the
 * seller's order, each with its icon and its name (seller data, shown as written), and, in New
 * sale only, the "Owing" chip after them (no icon: owing is not a method). Record payment passes
 * `allowOwing={false}`.
 *
 * It reads the list itself (`api/paymentMethods.ts`); while it loads the group is a skeleton
 * named "Loading payment methods". Chips wrap onto new lines, never scroll sideways and never
 * cut a name; each is at least 44 px tall (`.selector-pago__opcion`). The accessible name of a
 * chip is its method's name alone: the icon is decorative, and the chosen chip carries a check
 * mark and `aria-checked`, never colour alone. It allows no selection: `value` is
 * `PaymentChoice | null` and nothing here defaults it.
 *
 * Owing's `aria-describedby` only appears when the caller disables it and gives a description;
 * the caller (the sale form) decides when that is true, this component only wires them together.
 * A disabled Owing carries the native `disabled` attribute as well as `aria-disabled`.
 */

import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { usePaymentMethods } from '../api/paymentMethods'
import { PAYMENT_METHODS_TEXT } from '../copy/paymentMethods'
import type { PaymentChoice } from '../sales/pricing'
import Icono from './Icono'
import { iconOfMethod } from './paymentMethodIcons'

export interface SelectorPagoProps {
  value: PaymentChoice | null
  onChange: (value: PaymentChoice) => void
  /** Whether the "Owing" chip is offered: New sale only. */
  allowOwing?: boolean
  owingDisabled?: boolean
  owingDescription?: string
  required?: boolean
  /** The id of a refusal alert the group points at. */
  describedBy?: string
}

const CHIP = 'selector-pago__opcion'
const CHIP_ON = 'selector-pago__opcion selector-pago__opcion--activa'

export default function SelectorPago({
  value,
  onChange,
  allowOwing = true,
  owingDisabled = false,
  owingDescription,
  required = false,
  describedBy,
}: SelectorPagoProps) {
  const { t } = useTranslation()
  const descriptionId = useId()
  const methods = usePaymentMethods()
  const showDescription = allowOwing && owingDisabled && owingDescription !== undefined

  if (methods.isPending) {
    return (
      <div
        className="selector-pago selector-pago--cargando"
        role="progressbar"
        aria-label={PAYMENT_METHODS_TEXT.methodsLoading}
        aria-busy="true"
      >
        <span className="selector-pago__esqueleto" />
        <span className="selector-pago__esqueleto" />
        {allowOwing && <span className="selector-pago__esqueleto" />}
      </div>
    )
  }

  const owingChosen = value?.kind === 'owing'
  return (
    <div>
      <div
        className="selector-pago"
        role="radiogroup"
        aria-label={PAYMENT_METHODS_TEXT.methodGroupLabel}
        aria-required={required || undefined}
        aria-describedby={describedBy}
      >
        {(methods.data ?? []).map((method) => {
          const checked = value?.kind === 'method' && value.id === method.id
          return (
            <button
              key={method.id}
              type="button"
              role="radio"
              aria-checked={checked}
              className={checked ? CHIP_ON : CHIP}
              onClick={() => onChange({ kind: 'method', id: method.id })}
            >
              {checked && <Icono nombre="hecho" />}
              <Icono {...iconOfMethod(method.icon)} />
              <span className="selector-pago__nombre">{method.name}</span>
            </button>
          )
        })}
        {allowOwing && (
          <button
            type="button"
            role="radio"
            aria-checked={owingChosen}
            aria-disabled={owingDisabled}
            disabled={owingDisabled}
            aria-describedby={showDescription ? descriptionId : undefined}
            className={owingChosen ? CHIP_ON : CHIP}
            onClick={() => {
              if (!owingDisabled) onChange({ kind: 'owing' })
            }}
          >
            {owingChosen && <Icono nombre="hecho" />}
            <span className="selector-pago__nombre">{t('common:owing')}</span>
          </button>
        )}
      </div>
      {showDescription && (
        <span id={descriptionId} className="selector-pago__ayuda">
          {owingDescription}
        </span>
      )}
    </div>
  )
}
