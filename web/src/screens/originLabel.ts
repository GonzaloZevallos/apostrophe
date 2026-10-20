/** The word for a stock entry's origin, shared by every list of entries. */

import type { StockEntry } from '../api/stock'
import { COMMON_TEXT } from '../copy/common'

export const ORIGIN_LABEL: Record<StockEntry['origin'], string> = {
  purchase: COMMON_TEXT.compra,
  harvest: COMMON_TEXT.cosecha,
  opening_stock: COMMON_TEXT.stockInicial,
  adjustment: COMMON_TEXT.ajuste,
}
