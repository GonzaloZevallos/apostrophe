/**
 * What is missing at New sale's Product picker, decided over the Products answer for the
 * sale's date (`GET /api/products?on=`): no Product at all, Products but none with a Current
 * price on that date, or nothing missing. A Special price is a line's own and never appears in
 * that answer, so it is never a Current price here.
 */

import type { Variety } from '../screens/Variedades'

export type NothingSellable = 'noProducts' | 'noPrice' | null

export function nothingSellable(varieties: readonly Pick<Variety, 'current_price'>[]): NothingSellable {
  if (varieties.length === 0) return 'noProducts'
  if (varieties.every((item) => item.current_price === null)) return 'noPrice'
  return null
}
