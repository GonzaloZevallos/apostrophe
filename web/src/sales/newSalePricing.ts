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
import type { Variety } from '../screens/Variedades'
import type { PricedSale, PricedSaleLine, PricingSettings } from './pricing'
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

/** One draft line priced alone, against its own Product and with no shipping: what a row of the Product
 * list shows. The line is the draft's own (`saleLineInputsOf`), so no gift or special price reaches it.
 * `pricing` is `null` only for a rule the line breaks (No price); a data fault propagates, and a missing
 * answer is a fault too, never No price. */
export function pricedLineOf(input: {
  line: DraftLine
  product: Variety
  customerTypeId: number | null
  pricingSettings: PricingSettings
}): PricedSaleLine {
  const { line, product, customerTypeId, pricingSettings } = input
  const {
    lines: [priced],
  } = priceSale({
    lines: saleLineInputsOf([line]),
    customerTypeId,
    pricingSettings,
    products: [product],
    shippingCharged: 0,
  })
  if (priced === undefined) throw new Error('priceSale answered no line for the product')
  return priced
}

/** What Collect can do with the sale: the one place that decides it. Checked in this order: not ready is
 * `loading`; any line whose `pricing` is `null` is `unpriced` (whatever the shipping text); a shipping the
 * save cannot read is `shippingInvalid`; otherwise `ready` with the sale the save takes. */
export type CollectState =
  | { kind: 'loading' }
  | { kind: 'unpriced'; lines: readonly { id: number; name: string }[] }
  | { kind: 'shippingInvalid' }
  | { kind: 'ready'; sale: CompleteSale }

/** A line has no price only when its `pricing` is `null`: a Gift or a Special price line is never judged
 * by those fields here. `nameOf` gives the product's name for the id of each unpriced line, in draft order
 * (a draft line's id is its product id as text, `saleLineInputsOf`). */
export function collectStateOf(pricing: NewSalePricing, nameOf: (id: number) => string): CollectState {
  if (pricing.kind === 'notReady') return { kind: 'loading' }
  const lines = pricing.sale.lines
    .filter((line) => line.pricing === null)
    .map((line) => ({ id: Number(line.id), name: nameOf(Number(line.id)) }))
  if (lines.length > 0) return { kind: 'unpriced', lines }
  if (pricing.complete === null) return { kind: 'shippingInvalid' }
  return { kind: 'ready', sale: pricing.complete }
}

export type CollectFigure = { kind: 'loading' } | { kind: 'none' } | { kind: 'total'; total: number }

export interface CollectView {
  figure: CollectFigure
  warnings: readonly { id: number; name: string }[]
  /** Set only when the sale is ready and both the date and the total differ from the snapshot's. */
  note: { date: string; oldTotal: number; newTotal: number } | null
  canSend: boolean
}

/** What Collect shows and whether it can send, all read from the one `collectState`. `snapshot` is the
 * date and total Collect opened with. */
export function collectViewOf(input: {
  collectState: CollectState
  snapshot: { date: string; total: number }
  date: string
}): CollectView {
  const { collectState, snapshot, date } = input
  switch (collectState.kind) {
    case 'loading':
      return { figure: { kind: 'loading' }, warnings: [], note: null, canSend: false }
    case 'unpriced':
      return { figure: { kind: 'none' }, warnings: collectState.lines, note: null, canSend: false }
    case 'shippingInvalid':
      return { figure: { kind: 'none' }, warnings: [], note: null, canSend: false }
    case 'ready': {
      const total = collectState.sale.totals.total
      const changed = date !== snapshot.date && total !== snapshot.total
      return {
        figure: { kind: 'total', total },
        warnings: [],
        note: changed ? { date, oldTotal: snapshot.total, newTotal: total } : null,
        canSend: true,
      }
    }
    default: {
      const unreachable: never = collectState
      return unreachable
    }
  }
}
