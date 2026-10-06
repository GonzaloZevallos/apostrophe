/** The word for a stock entry's origin, shared by every list of entries. */

import type { StockEntry } from '../api/stock'

export const ORIGIN_LABEL: Record<StockEntry['origin'], string> = {
  purchase: 'Compra',
  harvest: 'Cosecha',
  opening_stock: 'Stock inicial',
  adjustment: 'Ajuste',
}
