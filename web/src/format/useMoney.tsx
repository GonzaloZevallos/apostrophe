/**
 * The business's money writers for a component: `GatedLayout` provides them from `me.money`, and
 * `useMoney()` hands a screen a formatter that always exists. There is no default format and no
 * "not loaded" value: until `me` arrives the gated layout renders nothing under it, so an amount
 * can never be written with a format that was guessed. Outside the provider the hook throws.
 */

import { createContext, type ReactNode, useContext, useMemo } from 'react'
import { type MoneyFormat, type MoneyFormatter, moneyFormatter } from './money'

const MoneyFormatContext = createContext<MoneyFormatter | undefined>(undefined)

/** Provides the formatter of `format` to everything below. */
export function MoneyFormatProvider({ format, children }: { format: MoneyFormat; children: ReactNode }) {
  const { symbol, decimals } = format
  const formatter = useMemo(() => moneyFormatter({ symbol, decimals }), [symbol, decimals])
  return <MoneyFormatContext.Provider value={formatter}>{children}</MoneyFormatContext.Provider>
}

export function useMoney(): MoneyFormatter {
  const formatter = useContext(MoneyFormatContext)
  if (formatter === undefined) throw new Error('useMoney() needs a MoneyFormatProvider above it')
  return formatter
}
