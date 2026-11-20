import { describe, expect, it } from 'vitest'
import type { VarietyStock } from '../api/stock'
import type { Variety } from '../screens/Variedades'
import { pricedRows, visibleRows } from './productRows'
import { type DraftState, initialDraft, MAX_QUANTITY_HUNDREDTHS, saleDraftReducer } from './saleDraft'

const SETTINGS_OFF = { bulk: false, vip: false }
const SETTINGS_ON = { bulk: true, vip: true }

function product(id: number, over: Partial<Variety> = {}, price: Partial<NonNullable<Variety['current_price']>> = {}): Variety {
  return {
    id,
    name: `Product ${id}`,
    archived: false,
    current_price: {
      id: id * 10,
      effective_from: '2026-01-01',
      list_price: 100,
      bulk_price: null,
      bulk_minimum: null,
      vip_price: null,
      ...price,
    },
    ...over,
  }
}

function stockOf(productId: number, over: Partial<VarietyStock> = {}): VarietyStock {
  return {
    product_id: productId,
    quantity: 500,
    status: 'ok',
    sold_out_since: null,
    threshold: null,
    days_left: null,
    ...over,
  }
}

function draftWith(...actions: Parameters<typeof saleDraftReducer>[1][]): DraftState {
  return actions.reduce(saleDraftReducer, initialDraft({ today: '2026-05-01' }))
}

const EMPTY = draftWith()

function rowsOf(
  products: Variety[],
  over: { draft?: DraftState; pricingSettings?: typeof SETTINGS_ON; customerTypeId?: number | null; stock?: VarietyStock[] } = {},
) {
  return pricedRows({
    products,
    stock: over.stock ?? products.map((item) => stockOf(item.id)),
    draft: over.draft ?? EMPTY,
    customerTypeId: over.customerTypeId ?? null,
    pricingSettings: over.pricingSettings ?? SETTINGS_OFF,
  })
}

describe('pricedRows', () => {
  it('prices a new line at the quantity the draft gives a product added', () => {
    const added = saleDraftReducer(EMPTY, { type: 'productAdded', productId: 1 })
    const defaultQuantity = added.lines[0]?.quantityHundredths
    const [row] = rowsOf([product(1, {}, { list_price: 7 })])
    expect(defaultQuantity).toBeDefined()
    expect(row?.pricing).toMatchObject({ rule: 'list', pricePerGram: 7 })
    // The default quantity is the draft's: the bulk minimum set at exactly that quantity applies.
    const [bulkRow] = rowsOf(
      [product(1, {}, { list_price: 100, bulk_price: 80, bulk_minimum: (defaultQuantity ?? 0) / 100 })],
      { pricingSettings: SETTINGS_ON },
    )
    expect(bulkRow?.pricing).toMatchObject({ rule: 'bulk', pricePerGram: 80 })
  })

  it('prices a product already in the sale at its line plus one step, so bulk applies at the minimum', () => {
    const wholesale = product(1, {}, { list_price: 100, bulk_price: 80, bulk_minimum: 3 })
    const inSale = draftWith(
      { type: 'productAdded', productId: 1 },
      { type: 'quantityTyped', productId: 1, text: '2' },
    )
    const [row] = rowsOf([wholesale], { draft: inSale, pricingSettings: SETTINGS_ON })
    expect(row?.pricing).toMatchObject({ rule: 'bulk', pricePerGram: 80, lineTotal: 240 })
    const [short] = rowsOf([wholesale], { pricingSettings: SETTINGS_ON })
    expect(short?.pricing).toMatchObject({ rule: 'list', pricePerGram: 100 })
  })

  it('prices a half-unit line at 1.5 under a bulk minimum of 1', () => {
    const wholesale = product(1, {}, { list_price: 100, bulk_price: 80, bulk_minimum: 1 })
    const half = draftWith(
      { type: 'productAdded', productId: 1 },
      { type: 'quantityTyped', productId: 1, text: '0.5' },
    )
    const [row] = rowsOf([wholesale], { draft: half, pricingSettings: SETTINGS_ON })
    expect(row?.pricing).toMatchObject({ rule: 'bulk', lineTotal: 120 })
  })

  it('prices a line at the cap at exactly that quantity', () => {
    const atCap = draftWith(
      { type: 'productAdded', productId: 1 },
      { type: 'quantityTyped', productId: 1, text: '9999999999999.99' },
    )
    expect(atCap.lines[0]?.quantityHundredths).toBe(MAX_QUANTITY_HUNDREDTHS)
    const [row] = rowsOf([product(1, {}, { list_price: 1 })], { draft: atCap })
    expect(row?.pricing).toMatchObject({ rule: 'list', lineTotal: 10_000_000_000_000 })
  })

  it('applies the bulk price only when bulk pricing is on', () => {
    const wholesale = product(1, {}, { list_price: 100, bulk_price: 80, bulk_minimum: 1 })
    const [off] = rowsOf([wholesale], { pricingSettings: { bulk: false, vip: true } })
    const [on] = rowsOf([wholesale], { pricingSettings: { bulk: true, vip: false } })
    expect(off?.pricing).toMatchObject({ rule: 'list', pricePerGram: 100 })
    expect(on?.pricing).toMatchObject({ rule: 'bulk', pricePerGram: 80 })
  })

  it('applies the Customer-type price only when the switch is on and the customer has a type', () => {
    const typed: Variety = {
      ...product(1),
      current_price: {
        ...product(1).current_price!,
        type_prices: [{ customer_type_id: 4, price: 60 }],
      },
    }
    const [off] = rowsOf([typed], { customerTypeId: 4, pricingSettings: { bulk: true, vip: false } })
    const [on] = rowsOf([typed], { customerTypeId: 4, pricingSettings: { bulk: false, vip: true } })
    const [noType] = rowsOf([typed], { customerTypeId: null, pricingSettings: SETTINGS_ON })
    expect(off?.pricing).toMatchObject({ rule: 'list', pricePerGram: 100 })
    expect(on?.pricing).toMatchObject({ rule: 'type', pricePerGram: 60, customerTypeId: 4 })
    expect(noType?.pricing).toMatchObject({ rule: 'list', pricePerGram: 100 })
  })

  it('gives no pricing for a product with no current price', () => {
    const [row] = rowsOf([product(1, { current_price: null })])
    expect(row?.pricing).toBeNull()
  })

  it('leaves archived products out', () => {
    const rows = rowsOf([product(1), product(2, { archived: true }), product(3)])
    expect(rows.map((row) => row.id)).toEqual([1, 3])
  })

  it('carries name, id and the stock figure and status of each product', () => {
    const [row] = rowsOf([product(5, { name: 'Rosa' })], {
      stock: [stockOf(5, { quantity: 12, status: 'low' })],
    })
    expect(row).toMatchObject({ id: 5, name: 'Rosa', stock: { quantity: 12, status: 'low' } })
  })

  it('gives stock null for a product the stock view has no row for', () => {
    const [row] = rowsOf([product(1)], { stock: [stockOf(2)] })
    expect(row?.stock).toBeNull()
  })

  it('throws on a malformed bulk minimum instead of giving no price', () => {
    const broken = product(1, {}, { bulk_price: 80, bulk_minimum: 1.005 })
    expect(() => rowsOf([broken])).toThrow('toHundredths expects grams already validated by parse.ts')
  })
})

describe('visibleRows', () => {
  function named(...names: string[]) {
    return rowsOf(names.map((name, index) => product(index + 1, { name })))
  }

  it('ignores case, accents and surrounding or extra spaces when filtering', () => {
    const rows = named('Árbol', 'Aroma', 'Bruma')
    expect(visibleRows(rows, '  ARBOL ').map((row) => row.name)).toEqual(['Árbol'])
    expect(visibleRows(rows, 'ÁROMA').map((row) => row.name)).toEqual(['Aroma'])
    expect(visibleRows(rows, '   ').map((row) => row.name)).toHaveLength(3)
  })

  it('returns no rows for a query that matches nothing', () => {
    expect(visibleRows(named('Árbol', 'Aroma'), 'zzz')).toEqual([])
  })

  it('orders by name', () => {
    const rows = named('Bruma', 'Aroma', 'Árbol')
    expect(visibleRows(rows, '').map((row) => row.name)).toEqual(['Árbol', 'Aroma', 'Bruma'])
  })

  it('breaks a tie of names by id', () => {
    const rows = rowsOf([product(7, { name: 'Rosa' }), product(3, { name: 'Rosa' })])
    expect(visibleRows(rows, '').map((row) => row.id)).toEqual([3, 7])
  })
})
