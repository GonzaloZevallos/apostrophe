/**
 * `pricedSaleOf` and `newSaleReady` at their own seam: one `priceSale` per state, shipping only in the
 * totals, `complete` only for a sale that can be saved as typed. No DOM.
 */

import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Variety } from '../screens/Variedades'
import {
  type CollectState,
  collectStateOf,
  collectViewOf,
  type CompleteSale,
  newSaleReady,
  pricedSaleOf,
  type NewSaleInputs,
} from './newSalePricing'
import * as pricing from './pricing'
import { draftLineOf, type DraftLine } from './saleDraft'

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
const PRICED_LINES: DraftLine[] = [draftLineOf(1, 200)]
const WITH_UNPRICED: DraftLine[] = [...PRICED_LINES, draftLineOf(2, 100)]

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

const NAMES = new Map([
  [1, 'Rosa'],
  [2, 'Sin precio'],
  [3, 'Otra sin precio'],
])
function nameOf(id: number): string {
  const name = NAMES.get(id)
  if (name === undefined) throw new Error('no name for product')
  return name
}
const NOT_READY_PRICING = pricedSaleOf({ ...READY, status: 'loading', lines: [], shipping: '0', format: FORMAT })
const PRODUCTS_WITH_THIRD: Variety[] = [...PRODUCTS, { id: 3, name: 'Otra sin precio', archived: false, current_price: null }]
const READY_WITH_THIRD: NewSaleInputs = { ...READY, products: PRODUCTS_WITH_THIRD }

describe('collectStateOf', () => {
  test('a Gift line and a Special price line on a no-price date stay priced', () => {
    const lines: DraftLine[] = [
      { ...draftLineOf(2, 100), gift: true },
      { ...draftLineOf(3, 100), specialPrice: 700 },
    ]
    const state = collectStateOf(pricedOf(lines, '0', READY_WITH_THIRD), nameOf)
    expect(state.kind).toBe('ready')
  })

  test('the unpriced lines are named by nameOf, in draft order', () => {
    const lines = [draftLineOf(3, 100), draftLineOf(1, 100), draftLineOf(2, 100)]
    expect(collectStateOf(pricedOf(lines, '0', READY_WITH_THIRD), nameOf)).toEqual({
      kind: 'unpriced',
      lines: [
        { id: 3, name: 'Otra sin precio' },
        { id: 2, name: 'Sin precio' },
      ],
    })
  })

  test('an unreadable shipping with every line priced is shippingInvalid', () => {
    expect(collectStateOf(pricedOf(PRICED_LINES, 'abc'), nameOf)).toEqual({ kind: 'shippingInvalid' })
    expect(collectStateOf(pricedOf(PRICED_LINES, ''), nameOf)).toEqual({ kind: 'shippingInvalid' })
  })

  test('an unpriced line and an unreadable shipping give unpriced', () => {
    expect(collectStateOf(pricedOf(WITH_UNPRICED, 'abc'), nameOf)).toEqual({
      kind: 'unpriced',
      lines: [{ id: 2, name: 'Sin precio' }],
    })
  })

  test('a sale not ready gives loading', () => {
    expect(NOT_READY_PRICING.kind).toBe('notReady')
    expect(collectStateOf(NOT_READY_PRICING, nameOf)).toEqual({ kind: 'loading' })
  })

  test('a complete sale gives ready with that sale', () => {
    const priced = pricedOf(PRICED_LINES, '0')
    const state = collectStateOf(priced, nameOf)
    expect(state).toEqual({ kind: 'ready', sale: priced.complete })
  })
})

describe('collectViewOf', () => {
  /** A real complete sale of `hundredths` of Rosa at 1000 a unit, so its total is 10 * hundredths. */
  const sale = (hundredths: number): CompleteSale => {
    const { complete } = pricedOf([draftLineOf(1, hundredths)], '0')
    if (complete === null) throw new Error('expected a complete sale')
    return complete
  }
  const SNAPSHOT = { date: '2026-10-01', total: sale(100).totals.total }
  const view = (collectState: CollectState, date = SNAPSHOT.date) => collectViewOf({ collectState, snapshot: SNAPSHOT, date })
  const READY_STATE: CollectState = { kind: 'ready', sale: sale(100) }
  const UNPRICED = [{ id: 2, name: 'Sin precio' }]

  test.each<[string, CollectState, ReturnType<typeof view>]>([
    ['loading', { kind: 'loading' }, { figure: { kind: 'loading' }, warnings: [], note: null, canSend: false }],
    [
      'unpriced',
      { kind: 'unpriced', lines: UNPRICED },
      { figure: { kind: 'none' }, warnings: UNPRICED, note: null, canSend: false },
    ],
    ['shippingInvalid', { kind: 'shippingInvalid' }, { figure: { kind: 'none' }, warnings: [], note: null, canSend: false }],
    ['ready', READY_STATE, { figure: { kind: 'total', total: SNAPSHOT.total }, warnings: [], note: null, canSend: true }],
  ])('%s', (_name, collectState, expected) => {
    expect(view(collectState)).toEqual(expected)
  })

  test('a date change gives no note while the state is not ready, whatever the total', () => {
    for (const state of [{ kind: 'loading' }, { kind: 'unpriced', lines: UNPRICED }, { kind: 'shippingInvalid' }] as const) {
      expect(view(state, '2026-09-20').note).toBeNull()
    }
  })

  test('a shipping-only change gives no note', () => {
    expect(view({ kind: 'ready', sale: sale(150) }).note).toBeNull()
  })

  test('the date changed and back, with a different total, gives no note', () => {
    expect(view({ kind: 'ready', sale: sale(150) }, SNAPSHOT.date).note).toBeNull()
  })

  test('a different date with the same total gives no note', () => {
    expect(view(READY_STATE, '2026-09-20').note).toBeNull()
  })

  test('a different date with a different total gives the note', () => {
    expect(view({ kind: 'ready', sale: sale(150) }, '2026-09-20').note).toEqual({
      date: '2026-09-20',
      oldTotal: SNAPSHOT.total,
      newTotal: sale(150).totals.total,
    })
  })

  test('loading shows no figure and cannot send', () => {
    const loading = view({ kind: 'loading' }, '2026-09-20')
    expect(loading.figure).toEqual({ kind: 'loading' })
    expect(loading.canSend).toBe(false)
  })
})
