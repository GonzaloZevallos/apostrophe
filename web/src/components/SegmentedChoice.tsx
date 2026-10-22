/**
 * `SegmentedChoice`: the segmented single-choice control the drawings use wherever a native
 * radio pair or trio used to be (`SelectorPago`, Registrar cobro's Efectivo · Transferencia).
 *
 * A `role="radiogroup"` of `role="radio"` buttons, each named exactly by its label. `value`
 * is `T | null`: nothing here defaults a choice. A disabled option carries the native
 * `disabled` as well as `aria-disabled`, so tests and assistive technology see the same
 * state the native radio it replaces had. `required` renders `aria-required` on the group,
 * `describedBy` is the group's own `aria-describedby` (a refusal alert, for instance), and
 * an option may carry its own. No arrow keys and no roving tabindex: every option is a
 * Tab-reachable button.
 */

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  disabled?: boolean
  describedBy?: string
}

export interface SegmentedChoiceProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T | null
  onChange: (value: T) => void
  ariaLabel: string
  required?: boolean
  describedBy?: string
}

export default function SegmentedChoice<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  required = false,
  describedBy,
}: SegmentedChoiceProps<T>) {
  return (
    <div
      className="selector-pago"
      role="radiogroup"
      aria-label={ariaLabel}
      aria-required={required || undefined}
      aria-describedby={describedBy}
    >
      {options.map((option) => {
        const checked = value === option.value
        const disabled = option.disabled === true
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-disabled={disabled}
            disabled={disabled}
            aria-describedby={option.describedBy}
            className={checked ? 'selector-pago__opcion selector-pago__opcion--activa' : 'selector-pago__opcion'}
            onClick={() => {
              if (!disabled) onChange(option.value)
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
