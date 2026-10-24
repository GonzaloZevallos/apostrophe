/**
 * One labelled amount on Análisis: a week or month cost row (`compact`), a summary-strip
 * withdrawal line or a "since your first record" metric (`row`). The label, the amount and
 * the marker are separate elements inside one group named by its own label, so a figure
 * never shares a text node with its words and never splits (`figure-split`,
 * design-system README §5). The `textContent` is `label + ' ' + amount + marker`, what the
 * single-node line read before. A value with no amount (everything pending) renders no
 * amount element and no `$`: the marker, the grams alone, sits where the figure would.
 */

import { useId } from 'react'
import type { AmountParts } from '../analisisCost'

export type AmountRowVariant = 'compact' | 'row'

export default function AmountRow({
  label,
  value,
  variant,
}: {
  label: string
  value: AmountParts
  variant: AmountRowVariant
}) {
  const labelId = useId()
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className={`analisis__monto analisis__monto--${variant === 'compact' ? 'compacto' : 'fila'}`}
    >
      <span id={labelId} className="analisis__monto-etiqueta">
        {label}
      </span>{' '}
      <span className="analisis__monto-valor">
        {value.amount !== null && <span className="analisis__monto-cifra">{value.amount}</span>}
        {value.marker !== '' && <span className="analisis__monto-marca">{value.marker}</span>}
      </span>
    </div>
  )
}
