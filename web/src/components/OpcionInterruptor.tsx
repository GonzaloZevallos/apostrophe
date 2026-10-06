/**
 * `OpcionInterruptor`: a whole-row switch (sales.md's "Regalo"). The row is one
 * `<label>` at least 44 px tall, so the label text and the track are both the tap
 * target; the native checkbox inside it (`role="switch"`) keeps the keyboard, the
 * focus ring and the accessible name. On and off are told by the thumb's position
 * and `aria-checked`, never by color alone.
 */

import { useId } from 'react'

export interface OpcionInterruptorProps {
  label: string
  checked: boolean
  disabled?: boolean
  /** The switch's accessible name when the screen's own name is longer than the visible
   * label (Nueva venta's "Regalo línea 2"); the visible text stays `label`. */
  ariaLabel?: string
  onChange: (checked: boolean) => void
}

export default function OpcionInterruptor({
  label,
  checked,
  disabled = false,
  ariaLabel,
  onChange,
}: OpcionInterruptorProps) {
  const id = useId()
  return (
    <label
      htmlFor={id}
      className={
        disabled ? 'opcion-interruptor opcion-interruptor--inactiva' : 'opcion-interruptor'
      }
    >
      <span className="opcion-interruptor__texto">{label}</span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="opcion-interruptor__input"
        checked={checked}
        disabled={disabled}
        aria-checked={checked}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="opcion-interruptor__pista" aria-hidden="true">
        <span className="opcion-interruptor__pulgar" />
      </span>
    </label>
  )
}
