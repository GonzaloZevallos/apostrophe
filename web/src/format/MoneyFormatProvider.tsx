/** Provides the writers of one Money format to everything below (`GatedLayout` does it from `me.money`). */

import { type ReactNode, useMemo } from 'react'
import { MoneyFormatContext } from './moneyContext'
import { type MoneyFormat, moneyFormatter } from './money'

export function MoneyFormatProvider({ format, children }: { format: MoneyFormat; children: ReactNode }) {
  const { symbol, decimals } = format
  const formatter = useMemo(() => moneyFormatter({ symbol, decimals }), [symbol, decimals])
  return <MoneyFormatContext.Provider value={formatter}>{children}</MoneyFormatContext.Provider>
}
