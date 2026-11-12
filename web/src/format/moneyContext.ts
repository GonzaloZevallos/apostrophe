/**
 * The context the business's money writers travel in, and `useMoney()`, the one way a component
 * reads them: a formatter that always exists. There is no default format and no "not loaded"
 * value: until `me` arrives the gated layout renders nothing under it, so an amount can never be
 * written with a format that was guessed. Outside the provider the hook throws.
 */

import { createContext, useContext } from 'react'
import type { MoneyFormatter } from './money'

export const MoneyFormatContext = createContext<MoneyFormatter | undefined>(undefined)

export function useMoney(): MoneyFormatter {
  const formatter = useContext(MoneyFormatContext)
  if (formatter === undefined) throw new Error('useMoney() needs a MoneyFormatProvider above it')
  return formatter
}
