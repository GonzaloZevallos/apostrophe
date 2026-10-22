/**
 * `SelectorPago` (`componentes.ts`'s `SelectorPagoProps`, plan "Components"): the
 * segmented control Efectivo · Transferencia · Debiendo, replacing the native
 * radio fieldset (PM, adjustment 2: Debiendo stays a disabled control with "Para
 * dejar debiendo elegí un cliente" as its accessible description — tests change
 * only the selector for that removed native `<input type="radio">`, never the
 * behaviour).
 *
 * A `role="radiogroup"` of three `role="radio"`s, named exactly "Efectivo",
 * "Transferencia" and "Debiendo" — nothing else in their accessible name, so a
 * screen reader announces the same three words the design shows. It allows no
 * selection: `value` is `PaymentChoice | null`, and nothing here defaults it.
 * Debiendo's `aria-describedby` only appears when the caller disables it and
 * gives a description — the caller (the sale form) decides when that is true,
 * this component only wires the two together.
 *
 * It is a thin wrapper over `SegmentedChoice`, which holds the markup. Disabled Debiendo carries the native `disabled` attribute too, not only
 * `aria-disabled` (review finding, plan-invariant: PM adjustment 2 says tests
 * "change only selectors for removed native controls" — a `button` can be
 * natively disabled same as the `<input type="radio">` it replaces, so the
 * form's tests keep `toBeDisabled()`/`toBeEnabled()` instead of reading a new
 * attribute).
 */

import { useId } from 'react'
import type { PaymentChoice } from '../sales/pricing'
import { COMMON_TEXT } from '../copy/common'
import SegmentedChoice from './SegmentedChoice'

export interface SelectorPagoProps {
  value: PaymentChoice | null
  onChange: (value: PaymentChoice) => void
  owingDisabled?: boolean
  owingDescription?: string
}

const OPTIONS: { value: PaymentChoice; label: string }[] = [
  { value: 'cash', label: COMMON_TEXT.cashMethod },
  { value: 'transfer', label: COMMON_TEXT.transfer },
  { value: 'owing', label: COMMON_TEXT.owing },
]

export default function SelectorPago({
  value,
  onChange,
  owingDisabled = false,
  owingDescription,
}: SelectorPagoProps) {
  const descriptionId = useId()
  const showDescription = owingDisabled && owingDescription !== undefined
  const options = OPTIONS.map((option) =>
    option.value === 'owing'
      ? { ...option, disabled: owingDisabled, describedBy: showDescription ? descriptionId : undefined }
      : option,
  )

  return (
    <div>
      <SegmentedChoice options={options} value={value} onChange={onChange} ariaLabel={COMMON_TEXT.howPaid} />
      {showDescription && (
        <span id={descriptionId} className="selector-pago__ayuda">
          {owingDescription}
        </span>
      )}
    </div>
  )
}
