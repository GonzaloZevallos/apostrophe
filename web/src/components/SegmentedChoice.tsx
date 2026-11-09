/**
 * `SegmentedChoice`: the segmented single-choice control for a fixed set (`SelectorPago`'s
 * Paid · Owing). Its options are a `FixedSet` (`fixedSets.ts`): a set read from the business's data
 * is chosen with the Selector, never here.
 *
 * A `role="radiogroup"` of `role="radio"` buttons, each named exactly by its label. `value`
 * is `T | null`: nothing here defaults a choice. An option the `optionState` overlay disables
 * carries the native `disabled` as well as `aria-disabled`, so tests and assistive technology see
 * the same state the native radio it replaces had; the overlay may also give an option its own
 * `aria-describedby`. No arrow keys and no roving tabindex: every option is a Tab-reachable button.
 */

import type { FixedSet } from './fixedSets'

export interface SegmentedChoiceProps<T extends string> {
  options: FixedSet<T>
  /** Runtime state of an option, keyed by value: the set itself holds none. */
  optionState?: Partial<Record<T, { disabled?: boolean; describedBy?: string }>>
  value: T | null
  onChange: (value: T) => void
  ariaLabel: string
}

export default function SegmentedChoice<T extends string>({
  options,
  optionState,
  value,
  onChange,
  ariaLabel,
}: SegmentedChoiceProps<T>) {
  return (
    <div className="selector-pago" role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => {
        const checked = value === option.value
        const state = optionState?.[option.value]
        const disabled = state?.disabled === true
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-disabled={disabled}
            disabled={disabled}
            aria-describedby={state?.describedBy}
            className={checked ? 'selector-pago__opcion selector-pago__opcion--activa' : 'selector-pago__opcion'}
            onClick={() => {
              if (!disabled) onChange(option.value)
            }}
          >
            {option.label()}
          </button>
        )
      })}
    </div>
  )
}
