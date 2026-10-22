/** The word for a stock entry's origin, shared by every list of entries. */

import type { StockEntry } from '../api/stock'
import { COMMON_TEXT } from '../copy/common'

export const ORIGIN_LABEL: Record<StockEntry['origin'], string> = {
  purchase: COMMON_TEXT.purchase,
  harvest: COMMON_TEXT.harvest,
  opening_stock: COMMON_TEXT.initialStock,
  adjustment: COMMON_TEXT.adjustment,
}
