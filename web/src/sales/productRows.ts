/**
 * The computer register's Products rows, as pure functions: `pricedRows` prices every listed
 * Product at the quantity a click on it would give (`sale-in-progress.md`), and `visibleRows`
 * filters and orders what it returned. Every figure comes from `priceSale`; no money is computed
 * here and no quantity or step is named here: the quantity is whatever `saleDraftReducer` gives a
 * Product added.
 */

import type { VarietyStock, Status } from '../api/stock'
import { matchesQuery } from '../components/selectorSearch'
import type { Variety } from '../screens/Variedades'
import { varietiesByName } from '../screens/varieties/varietiesByName'
import { priceSale, type PricedSaleLine, type PricingSettings } from './pricing'
import { type DraftState, saleDraftReducer } from './saleDraft'

export interface ProductRow {
  id: number
  name: string
  /** `null` when the stock view has no row for the Product: never a 0 or an invented status. */
  stock: { quantity: number; status: Status } | null
  /** `null` means No price. */
  pricing: PricedSaleLine['pricing']
}

/** One row per Product that is not archived. A data fault in a Product (a malformed bulk minimum)
 * propagates: it is never turned into No price. */
export function pricedRows(input: {
  products: readonly Variety[]
  stock: readonly VarietyStock[]
  draft: DraftState
  customerTypeId: number | null
  pricingSettings: PricingSettings
}): ProductRow[] {
  const { products, stock, draft, customerTypeId, pricingSettings } = input
  const stockByProduct = new Map(stock.map((row) => [row.product_id, row]))
  const rows: ProductRow[] = []
  for (const product of products) {
    if (product.archived) continue
    const productId = product.id
    const added = saleDraftReducer(draft, { type: 'productAdded', productId })
    const line = added.lines.find((candidate) => candidate.productId === productId)
    // `productAdded` always leaves the Product's line in the draft.
    if (line === undefined) throw new Error('productAdded left no line for the product')
    const { lines: [priced] } = priceSale({
      // `DraftLine` carries neither `gift` nor `specialPrice`, so they are constants here.
      lines: [{ id: String(productId), productId, gramsHundredths: line.quantityHundredths, gift: false, specialPrice: null }],
      customerTypeId,
      pricingSettings,
      products: [product],
      shippingCharged: 0,
    })
    // `priceSale` answers one line per line given; a missing one is a fault, never No price.
    if (priced === undefined) throw new Error('priceSale answered no line for the product')
    const stocked = stockByProduct.get(productId)
    rows.push({
      id: productId,
      name: product.name,
      stock: stocked === undefined ? null : { quantity: stocked.quantity, status: stocked.status },
      pricing: priced.pricing,
    })
  }
  return rows
}

/** The rows whose name matches `query`, in the Products tab's one order. */
export function visibleRows(priced: readonly ProductRow[], query: string): ProductRow[] {
  return varietiesByName(priced.filter((row) => matchesQuery(row.name, query)))
}
