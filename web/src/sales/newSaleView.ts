/**
 * What New sale's sale bar and Customer row show, decided from values and nothing else: pure, no React,
 * no hook, no DOM. The wiring part of GH-496 builds a `CustomerView` and calls these; no route mounts
 * this module before then.
 */

import type { CompleteSale, NewSalePricing } from './newSalePricing'
import type { NewSaleStatus } from './useNewSaleReads'

/** The sale's Customer as the Customer row and the price need it. `typeId` and `typeName` are both set or
 * the Customer counts as having no type. */
export type CustomerView =
  | { kind: 'none' }
  | { kind: 'known'; name: string; typeId: number | null; typeName: string | null }
  | { kind: 'namePending' }
  | { kind: 'typePending'; name: string }
  | { kind: 'failed' }

/** The one place the Customer's type is read: only a `known` Customer with both its id and its name has one. */
function appliedTypeOf(view: CustomerView): { id: number; name: string } | null {
  if (view.kind !== 'known' || view.typeId === null || view.typeName === null) return null
  return { id: view.typeId, name: view.typeName }
}

/** The Customer type id for `NewSaleInputs.customerTypeId`: `null` for none or a Customer without a type,
 * `'pending'` for every kind that is not settled (including a failed read). */
export function customerTypeIdOf(view: CustomerView): number | null | 'pending' {
  switch (view.kind) {
    case 'none':
      return null
    case 'known':
      return appliedTypeOf(view)?.id ?? null
    case 'namePending':
    case 'typePending':
    case 'failed':
      return 'pending'
    default: {
      const unreachable: never = view
      return unreachable
    }
  }
}

export type PriceLine = { kind: 'list' } | { kind: 'type'; name: string } | { kind: 'loading' } | { kind: 'none' }

/** The label of the Customer row's price line. It labels the Customer row and never states a line's
 * `pricing.rule`: a Product with no price for the Customer's type is still priced `list` on its line. */
export function priceLineOf(view: CustomerView, customerTypesOn: boolean): PriceLine {
  switch (view.kind) {
    case 'namePending':
    case 'typePending':
      return { kind: 'loading' }
    case 'failed':
      return { kind: 'none' }
    case 'none':
    case 'known': {
      const type = appliedTypeOf(view)
      return type !== null && customerTypesOn ? { kind: 'type', name: type.name } : { kind: 'list' }
    }
    default: {
      const unreachable: never = view
      return unreachable
    }
  }
}

export type SaleBarState =
  | { kind: 'empty' }
  | { kind: 'counting' }
  | { kind: 'count' }
  | { kind: 'total'; n: number; sale: CompleteSale }

/**
 * The sale bar, the first of these that holds:
 * 1. `empty` when there are no lines;
 * 2. `counting` when the status is `loading` or `refreshing`, or the Customer is `namePending` or `typePending`;
 * 3. `count` when the status is `failed`, the Customer read `failed`, the pricing is `notReady` or its `complete` is null;
 * 4. otherwise `total`, with the line count and the very `CompleteSale` of the price result.
 *
 * The wiring part must settle the Customer read (to known, none or failed) before a failed status can
 * show: a Customer still pending keeps the bar on `counting`.
 */
export function saleBarState(input: {
  status: NewSaleStatus
  customer: CustomerView
  pricing: NewSalePricing
  lineCount: number
}): SaleBarState {
  const { status, customer, pricing, lineCount } = input
  if (lineCount === 0) return { kind: 'empty' }
  if (
    status === 'loading' ||
    status === 'refreshing' ||
    customer.kind === 'namePending' ||
    customer.kind === 'typePending'
  ) {
    return { kind: 'counting' }
  }
  if (status === 'failed' || customer.kind === 'failed') return { kind: 'count' }
  switch (pricing.kind) {
    case 'notReady':
      return { kind: 'count' }
    case 'priced':
      return pricing.complete === null
        ? { kind: 'count' }
        : { kind: 'total', n: lineCount, sale: pricing.complete }
    default: {
      const unreachable: never = pricing
      return unreachable
    }
  }
}
