/** The word for a stock entry's origin, shared by every list of entries. */

import type { StockEntry } from '../api/stock'
import { ORIGIN_ADJUSTMENT, ORIGIN_HARVEST, ORIGIN_OPENING_STOCK, ORIGIN_PURCHASE } from '../copy/stock'

export const ORIGIN_LABEL: Record<StockEntry['origin'], string> = {
  purchase: ORIGIN_PURCHASE,
  harvest: ORIGIN_HARVEST,
  opening_stock: ORIGIN_OPENING_STOCK,
  adjustment: ORIGIN_ADJUSTMENT,
}
