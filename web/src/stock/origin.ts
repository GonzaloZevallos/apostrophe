import type { StockEntry } from '../api/stock'

/** The seller's word for each stock-entry origin (`CONTEXT.md`). */
export const ORIGIN_LABEL: Record<StockEntry['origin'], string> = {
  purchase: 'Compra',
  harvest: 'Cosecha',
  opening_stock: 'Stock inicial',
  adjustment: 'Ajuste',
}
