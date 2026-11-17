/**
 * `MoneyInput`: the text field every amount is typed into. Its keyboard comes from `moneyInputMode`
 * and its text is the host's (a string it parses with `parseMoneyInput` and prefills through
 * `formatMoneyInput`). When the business keeps decimals, leaving the field shows a readable amount
 * back with a comma and exactly those decimals (`11.5` becomes `11,50`); with 0 decimals the field
 * keeps what was typed, as it always did.
 */

import type { ComponentProps } from 'react'
import { useMoney } from '../format/moneyContext'
import { formatMoneyInput, moneyInputMode, parseMoneyInput } from '../format/parse'

type MoneyInputProps = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'inputMode'> & {
  value: string
  onChange: (value: string) => void
}

export default function MoneyInput({ value, onChange, onBlur, ...rest }: MoneyInputProps) {
  const { format } = useMoney()
  return (
    <input
      {...rest}
      inputMode={moneyInputMode(format)}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={(event) => {
        if (format.decimals > 0) {
          const parsed = parseMoneyInput(value, format)
          if (parsed.ok && formatMoneyInput(parsed.value, format) !== value) onChange(formatMoneyInput(parsed.value, format))
        }
        onBlur?.(event)
      }}
    />
  )
}
