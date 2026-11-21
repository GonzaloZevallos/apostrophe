/**
 * `pricedSaleOf` and `newSaleReady` at their own seam: one `priceSale` per state, shipping only in the
 * totals, `complete` only for a sale that can be saved as typed. No DOM.
 */

import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Variety } from '../screens/Variedades'
import { newSaleReady, pricedSaleOf, type NewSaleInputs } from './newSalePricing'
import * as pricing from './pricing'
import type { DraftLine } from './saleDraft'

const FORMAT = { symbol: '$', decimals: 0 }
const price = { id: 1, effective_from: '2026-09-01', list_price: 1000, bulk_price: null, bulk_minimum: null, vip_price: null }
const PRODUCTS: Variety[] = [
  { id: 1, name: 'Rosa', archived: false, current_price: price },
  { id: 2, name: 'Sin precio', archived: false, current_price: null },
]
const READY: NewSaleInputs = {
  status: 'ready',
  products: PRODUCTS,
  settings: { bulk: false, vip: false },
  mostSoldIds: [1],
  customerTypeId: null,
}
const PRICED_LINES: DraftLine[] = [{ productId: 1, quantityHundredths: 200 }]
const WITH_UNPRICED: DraftLine[] = [...PRICED_LINES, { productId: 2, quantityHundredths: 100 }]

function pricedOf(lines: DraftLine[], shipping: string, reads: NewSaleInputs = READY) {
  const result = pricedSaleOf({ ...reads, lines, shipping, format: FORMAT })
  if (result.kind !== 'priced') throw new Error('expected a priced sale')
  return result
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('complete', () => {
  test('blank shipping gives a priced sale and no complete', () => {
    const result = pricedOf(PRICED_LINES, '')
    expect(result.sale.lines).toHaveLength(1)
    expect(result.complete).toBeNull()
  })

  test("'0' gives complete, the same object, whose total is the sum of the lines", () => {
    const result = pricedOf(PRICED_LINES, '0')
    expect(result.complete).toBe(result.sale)
    expect(result.complete?.totals.shippingCharged).toBe(0)
    const sum = result.sale.lines.reduce((total, line) => total + (line.pricing?.lineTotal ?? 0), 0)
    expect(sum).toBeGreaterThan(0)
    expect(result.complete?.totals.total).toBe(sum)
  })

  test("'500' puts the shipping into complete's totals", () => {
    const without = pricedOf(PRICED_LINES, '0')
    const result = pricedOf(PRICED_LINES, '500')
    expect(result.complete?.totals.shippingCharged).toBe(500)
    expect(result.complete?.totals.total).toBe((without.complete?.totals.total ?? 0) + 500)
  })

  test("'abc' gives a priced sale and no complete", () => {
    const result = pricedOf(PRICED_LINES, 'abc')
    expect(result.sale.totals.total).toBe(pricedOf(PRICED_LINES, '0').sale.totals.total)
    expect(result.complete).toBeNull()
  })

  test('an unpriced line gives no complete while the sale is still priced', () => {
    const result = pricedOf(WITH_UNPRICED, '0')
    expect(result.sale.lines.map((line) => line.pricing === null)).toEqual([false, true])
    expect(result.complete).toBeNull()
  })

  test('the lines are the same for any shipping text', () => {
    const lines = pricedOf(PRICED_LINES, '').sale.lines
    expect(pricedOf(PRICED_LINES, '500').sale.lines).toEqual(lines)
    expect(pricedOf(PRICED_LINES, 'abc').sale.lines).toEqual(lines)
  })
})

describe('notReady', () => {
  const NOT_READY: [string, NewSaleInputs][] = [
    ['loading', { ...READY, status: 'loading' }],
    ['refreshing', { ...READY, status: 'refreshing' }],
    ['failed', { ...READY, status: 'failed' }],
    ['no products', { ...READY, products: null }],
    ['no settings', { ...READY, settings: null }],
    ['no suggestions', { ...READY, mostSoldIds: null }],
    ['a pending Customer', { ...READY, customerTypeId: 'pending' }],
  ]

  test.each(NOT_READY)('%s gives notReady', (_name, reads) => {
    expect(newSaleReady(reads)).toBe(false)
    expect(pricedSaleOf({ ...reads, lines: PRICED_LINES, shipping: '0', format: FORMAT })).toEqual({ kind: 'notReady' })
  })

  test('everything in gives ready, with or without a Customer type', () => {
    expect(newSaleReady(READY)).toBe(true)
    expect(newSaleReady({ ...READY, customerTypeId: 7 })).toBe(true)
  })
})

describe('priceSale calls', () => {
  test('one for a complete state, one for an unpriced line, none for notReady', () => {
    const spy = vi.spyOn(pricing, 'priceSale')

    pricedOf(PRICED_LINES, '0')
    expect(spy).toHaveBeenCalledTimes(1)

    spy.mockClear()
    pricedOf(WITH_UNPRICED, '0')
    expect(spy).toHaveBeenCalledTimes(1)

    spy.mockClear()
    pricedSaleOf({ ...READY, status: 'loading', lines: PRICED_LINES, shipping: '0', format: FORMAT })
    expect(spy).not.toHaveBeenCalled()
  })
})
