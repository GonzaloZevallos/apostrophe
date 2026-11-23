/**
 * New sale's one price result: `pricedSaleOf` makes the single `priceSale` call for the sale, and
 * everything that shows a figure for New sale's Sale (the Product list now, the sale bar and Collect
 * later) reads that result. Not mounted by any route until the flip part of GH-496.
 *
 * Shipping reaches only the totals (`priceSale` prices each line without it), so `sale.lines` is the
 * same for any shipping text. `complete` is the sale only when it can be saved as typed: shipping
 * parsed and every line priced.
 */

import type { MoneyFormat } from '../format/money'
import type { PricedSale } from './pricing'
import { priceSale } from './pricing'
import { saleLineInputsOf, type DraftLine } from './saleDraft'
import { parseShipping } from './shipping'
import type { NewSaleReads } from './useNewSaleReads'

/** Private to this module, and never exported: a type-only brand that only `pricedSaleOf` can put on a sale. */
declare const complete: unique symbol

/** A priced sale whose shipping parsed and whose every line has a price. */
export type CompleteSale = PricedSale & { readonly [complete]: true }

export type NewSalePricing =
  | { kind: 'notReady' }
  | { kind: 'priced'; sale: PricedSale; complete: CompleteSale | null }

type Reads = Pick<NewSaleReads, 'status' | 'products' | 'settings' | 'mostSoldIds'>

/** `customerTypeId` is the sale's Customer type id, `null` for none, or `'pending'` while the Customer is in flight. */
export interface NewSaleInputs extends Reads {
  customerTypeId: number | null | 'pending'
}

/** The one condition under which a figure is priced: every read is in for the sale's date and the
 * Customer is known. `pending` stands for the marks, whatever the status was. */
export function newSaleReady(
  reads: NewSaleInputs,
): reads is NewSaleInputs & {
  status: 'ready'
  products: NonNullable<NewSaleInputs['products']>
  settings: NonNullable<NewSaleInputs['settings']>
  mostSoldIds: NonNullable<NewSaleInputs['mostSoldIds']>
  customerTypeId: number | null
} {
  const { status, products, settings, mostSoldIds, customerTypeId } = reads
  return (
    status === 'ready' &&
    products !== null &&
    settings !== null &&
    mostSoldIds !== null &&
    customerTypeId !== 'pending'
  )
}

/** Not ready gives `notReady` and no `priceSale` call; otherwise exactly one, with a blank or unreadable
 * shipping charged as 0 (`complete` is then `null`: the save refuses what the parser cannot read). */
export function pricedSaleOf(
  input: NewSaleInputs & { lines: readonly DraftLine[]; shipping: string; format: MoneyFormat },
): NewSalePricing {
  if (!newSaleReady(input)) return { kind: 'notReady' }
  const { products, settings, customerTypeId, lines, shipping, format } = input
  const shippingCharged = parseShipping(shipping, format)
  const sale = priceSale({
    lines: saleLineInputsOf(lines),
    customerTypeId,
    pricingSettings: settings,
    products,
    shippingCharged: shippingCharged ?? 0,
  })
  const everyLinePriced = sale.lines.every((line) => line.pricing !== null)
  return {
    kind: 'priced',
    sale,
    // The one cast of `CompleteSale` in the code base: a brand that exists only in the type cannot be put
    // on an existing object any other way, and this is where the conditions that earn it are checked.
    complete: shippingCharged !== null && everyLinePriced ? (sale as CompleteSale) : null,
  }
}
