/**
 * The New sale bar and Customer row decisions at their own seam: every branch of `saleBarState`,
 * `priceLineOf` and `customerTypeIdOf`, with expected values written by hand. No DOM.
 */

import { describe, expect, test } from 'vitest'
import type { Variety } from '../screens/Variedades'
import { pricedSaleOf, type NewSaleInputs, type NewSalePricing } from './newSalePricing'
import {
  customerTypeIdOf,
  priceLineOf,
  saleBarState,
  type CustomerView,
} from './newSaleView'
import type { DraftLine } from './saleDraft'
import type { NewSaleStatus } from './useNewSaleReads'

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

function pricing(lines: DraftLine[], shipping: string, reads: NewSaleInputs = READY): NewSalePricing {
  return pricedSaleOf({ ...reads, lines, shipping, format: FORMAT })
}

const COMPLETE = pricing(PRICED_LINES, '0')
const NO_COMPLETE = pricing(PRICED_LINES, '')
const UNPRICED_LINE = pricing(WITH_UNPRICED, '0')
const NOT_READY = pricing(PRICED_LINES, '0', { ...READY, status: 'loading' })

const NONE: CustomerView = { kind: 'none' }
const KNOWN: CustomerView = { kind: 'known', name: 'Ana', typeId: 7, typeName: 'Mayorista' }
const KNOWN_NO_TYPE: CustomerView = { kind: 'known', name: 'Ana', typeId: null, typeName: null }
const NAME_ONLY: CustomerView = { kind: 'known', name: 'Ana', typeId: null, typeName: 'Mayorista' }
const ID_ONLY: CustomerView = { kind: 'known', name: 'Ana', typeId: 7, typeName: null }
const NAME_PENDING: CustomerView = { kind: 'namePending' }
const TYPE_PENDING: CustomerView = { kind: 'typePending', name: 'Ana' }
const FAILED: CustomerView = { kind: 'failed' }

describe('the fixtures', () => {
  test('are the price results the table needs', () => {
    expect(COMPLETE.kind).toBe('priced')
    expect(COMPLETE.kind === 'priced' && COMPLETE.complete !== null).toBe(true)
    expect(NO_COMPLETE.kind === 'priced' && NO_COMPLETE.complete === null).toBe(true)
    expect(UNPRICED_LINE.kind === 'priced' && UNPRICED_LINE.complete === null).toBe(true)
    expect(NOT_READY.kind).toBe('notReady')
  })
})

describe('saleBarState', () => {
  const ROWS: [string, NewSaleStatus, CustomerView, NewSalePricing, number, string][] = [
    ['no lines', 'ready', NONE, COMPLETE, 0, 'empty'],
    ['empty over a failed status', 'failed', NONE, NOT_READY, 0, 'empty'],
    ['empty over a failed Customer', 'ready', FAILED, COMPLETE, 0, 'empty'],
    ['empty over a loading status', 'loading', NONE, NOT_READY, 0, 'empty'],
    ['empty over a pending Customer', 'ready', NAME_PENDING, NOT_READY, 0, 'empty'],
    ['loading status', 'loading', NONE, NOT_READY, 1, 'counting'],
    ['refreshing status', 'refreshing', KNOWN, COMPLETE, 1, 'counting'],
    ['name pending', 'ready', NAME_PENDING, NOT_READY, 1, 'counting'],
    ['type pending', 'ready', TYPE_PENDING, NOT_READY, 1, 'counting'],
    ['failed status over a name pending Customer', 'failed', NAME_PENDING, NOT_READY, 1, 'counting'],
    ['failed status over a type pending Customer', 'failed', TYPE_PENDING, NOT_READY, 1, 'counting'],
    ['loading status over a failed Customer', 'loading', FAILED, NOT_READY, 1, 'counting'],
    ['failed status', 'failed', NONE, NOT_READY, 1, 'count'],
    ['failed status over a complete price', 'failed', KNOWN, COMPLETE, 1, 'count'],
    ['failed Customer with a ready status', 'ready', FAILED, NOT_READY, 1, 'count'],
    ['failed Customer over a complete price', 'ready', FAILED, COMPLETE, 1, 'count'],
    ['priced without complete', 'ready', NONE, NO_COMPLETE, 2, 'count'],
    ['priced with an unpriced line', 'ready', NONE, UNPRICED_LINE, 2, 'count'],
    ['not ready pricing with a ready status', 'ready', NONE, NOT_READY, 1, 'count'],
  ]

  test.each(ROWS)('%s', (_name, status, customer, priced, lineCount, expected) => {
    expect(saleBarState({ status, customer, pricing: priced, lineCount }).kind).toBe(expected)
  })

  test('total carries the line count and the very sale pricedSaleOf returned', () => {
    if (COMPLETE.kind !== 'priced') throw new Error('expected a priced sale')
    const bar = saleBarState({ status: 'ready', customer: KNOWN, pricing: COMPLETE, lineCount: 3 })
    expect(bar.kind).toBe('total')
    if (bar.kind !== 'total') return
    expect(bar.n).toBe(3)
    expect(bar.sale).toBe(COMPLETE.complete)
  })

  test('total with no Customer', () => {
    expect(saleBarState({ status: 'ready', customer: NONE, pricing: COMPLETE, lineCount: 1 }).kind).toBe('total')
  })
})

describe('priceLineOf', () => {
  test.each([
    ['none, switch on', NONE, true, { kind: 'list' }],
    ['none, switch off', NONE, false, { kind: 'list' }],
    ['typed known, switch on', KNOWN, true, { kind: 'type', name: 'Mayorista' }],
    ['typed known, switch off', KNOWN, false, { kind: 'list' }],
    ['known without a type, switch on', KNOWN_NO_TYPE, true, { kind: 'list' }],
    ['typeName with a null typeId', NAME_ONLY, true, { kind: 'list' }],
    ['typeId with a null typeName', ID_ONLY, true, { kind: 'list' }],
    ['name pending, switch on', NAME_PENDING, true, { kind: 'loading' }],
    ['name pending, switch off', NAME_PENDING, false, { kind: 'loading' }],
    ['type pending, switch on', TYPE_PENDING, true, { kind: 'loading' }],
    ['type pending, switch off', TYPE_PENDING, false, { kind: 'loading' }],
    ['failed, switch on', FAILED, true, { kind: 'none' }],
    ['failed, switch off', FAILED, false, { kind: 'none' }],
  ])('%s', (_name, view, on, expected) => {
    expect(priceLineOf(view, on)).toEqual(expected)
  })
})

describe('customerTypeIdOf', () => {
  test.each([
    ['none', NONE, null],
    ['typed known', KNOWN, 7],
    ['known without a type', KNOWN_NO_TYPE, null],
    ['typeName with a null typeId', NAME_ONLY, null],
    ['typeId with a null typeName', ID_ONLY, null],
    ['name pending', NAME_PENDING, 'pending'],
    ['type pending', TYPE_PENDING, 'pending'],
    ['failed', FAILED, 'pending'],
  ])('%s', (_name, view, expected) => {
    expect(customerTypeIdOf(view)).toBe(expected)
  })
})
