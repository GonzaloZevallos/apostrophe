/** `catalogRow`: the model of one row in the phone Products Catalog view, asserted on the real English copy. */

import { describe, expect, test } from 'vitest'
import { moneyFormatter } from '../../format/money'
import { testT } from '../../i18n/testing'
import { catalogRow, type CatalogRowInput } from './catalogRow'

const money = moneyFormatter({ symbol: '$', decimals: 2 })

const PRICED = { list_price: 10, bulk_price: null }
const BULK = { list_price: 10, bulk_price: 8 }

function rowOf(over: Partial<CatalogRowInput> = {}) {
  return catalogRow(
    { name: 'Lemon', currentPrice: PRICED, isBulkPricing: false, status: 'ok', hidden: false, ...over },
    money,
    testT,
  )
}

describe('the price line', () => {
  test('a current price reads through the existing price copy', () => {
    const row = rowOf()
    expect(row.priceLine).toBe(testT('common:pricePerGram', { amount: money.money(10) }))
    expect(row.priceLine).toContain(money.money(10))
    expect(row.hint).toBeNull()
  })

  test('the Bulk part follows when Bulk pricing is on and a bulk price is set', () => {
    const row = rowOf({ currentPrice: BULK, isBulkPricing: true })
    expect(row.priceLine).toBe(`${testT('common:pricePerGram', { amount: money.money(10) })} · Bulk ${money.money(8)}`)
  })

  test('the Bulk part is left out with no bulk price', () => {
    const row = rowOf({ currentPrice: PRICED, isBulkPricing: true })
    expect(row.priceLine).not.toContain('Bulk')
  })

  test('the Bulk part is left out when Bulk pricing is off, whatever the bulk price', () => {
    const row = rowOf({ currentPrice: BULK, isBulkPricing: false })
    expect(row.priceLine).not.toContain('Bulk')
  })

  test('no current price reads No price with its hint', () => {
    const row = rowOf({ currentPrice: null, isBulkPricing: true })
    expect(row.priceLine).toBe('No price')
    expect(row.hint).toBe('A product needs a price before you can sell it.')
  })
})

describe('the badge', () => {
  test.each([
    ['sold_out', 'sold_out'],
    ['low', 'low'],
    ['ok', null],
    ['no_entries', null],
    [undefined, null],
  ] as const)('status %s gives badge %s', (status, badge) => {
    expect(rowOf({ status }).badge).toBe(badge)
  })
})

test('hidden passes through as given', () => {
  expect(rowOf({ hidden: true }).hidden).toBe(true)
  expect(rowOf({ hidden: false }).hidden).toBe(false)
})

describe('the accessible name', () => {
  const price = testT('common:pricePerGram', { amount: money.money(10) })

  test('a plain product is the name and the price line', () => {
    expect(rowOf().accessibleName).toBe(`Lemon, ${price}`)
  })

  test('everything that applies reads in order: name, price, status word, Hidden', () => {
    const row = rowOf({ currentPrice: BULK, isBulkPricing: true, status: 'low', hidden: true })
    expect(row.accessibleName).toBe(`Lemon, ${price} · Bulk ${money.money(8)}, Low, Hidden`)
  })

  test('a part that does not apply drops with its separator', () => {
    expect(rowOf({ status: 'sold_out' }).accessibleName).toBe(`Lemon, ${price}, Sold out`)
    expect(rowOf({ hidden: true }).accessibleName).toBe(`Lemon, ${price}, Hidden`)
    expect(rowOf({ status: 'no_entries' }).accessibleName).toBe(`Lemon, ${price}`)
  })

  test('no price, a badge and Hidden together', () => {
    const row = rowOf({ currentPrice: null, status: 'sold_out', hidden: true })
    expect(row.accessibleName).toBe('Lemon, No price, A product needs a price before you can sell it., Sold out, Hidden')
  })

  test.each(['{{items}}', '{{amount}}', 'Cost $& $1 $$', "O'Brien's {{name}}"])(
    'a name that looks like a placeholder comes out as typed: %s',
    (name) => {
      expect(rowOf({ name }).accessibleName).toBe(`${name}, ${price}`)
      expect(rowOf({ name, hidden: true, status: 'low' }).accessibleName).toBe(`${name}, ${price}, Low, Hidden`)
    },
  )
})
