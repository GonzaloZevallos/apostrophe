import { describe, expect, test } from 'vitest'
import type { Variety } from '../screens/Variedades'
import matrix from './pricing-matrix.json'
import {
  GiftWithSpecialPrice,
  InvalidSpecialPrice,
  NonPositiveGrams,
  NoPriceThatDay,
  type LineInput,
  type PricedSale,
  type PricedSaleLine,
  type PricingRule,
  type SaleLineInput,
  fromHundredths,
  hundredthsOfApiGrams,
  linesRepriced,
  paymentChoiceOf,
  priceLine,
  priceSale,
  quoteOf,
  saleTotals,
  toHundredths,
  validateSale,
} from './pricing'

const ERRORS = {
  NonPositiveGrams,
  GiftWithSpecialPrice,
  InvalidSpecialPrice,
  NoPriceThatDay,
} as const

/** The matrix still names the type rule `vip`; a line priced by a type's price is `type` now
 * (the same mapping `tests/sales/test_pricing_matrix.py` makes). */
const storedRule = (rule: string): string => (rule === 'vip' ? 'type' : rule)

// The pricing matrix (`pricing-matrix.json`) is shared with `tests/sales/test_pricing_matrix.py`:
// a rule change in the domain that isn't mirrored here breaks one side or the other.
describe('priceLine, against the shared pricing matrix', () => {
  for (const line of matrix.lines) {
    test(line.name, () => {
      const input = line.input as LineInput
      if ('error' in line.expect) {
        const ErrorClass = ERRORS[line.expect.error as keyof typeof ERRORS]
        expect(() => priceLine(input)).toThrow(ErrorClass)
      } else {
        const result = priceLine(input)
        expect(result.rule).toBe(storedRule(line.expect.rule) as PricingRule)
        expect(result.pricePerGram).toBe(line.expect.pricePerGram)
        expect(result.lineTotal).toBe(line.expect.lineTotal)
      }
    })
  }
})

describe('saleTotals, against the shared pricing matrix', () => {
  for (const entry of matrix.totals) {
    test(entry.name, () => {
      const results = entry.lines.map((line) => priceLine(line as LineInput))
      if ('expectRules' in entry) {
        expect(results.map((r) => r.rule)).toEqual((entry.expectRules ?? []).map(storedRule))
      }
      const priced = results.map((result, i) => {
        const input = entry.lines[i] as LineInput
        return { gift: input.gift, gramsHundredths: input.gramsHundredths, lineTotal: result.lineTotal }
      })
      const totals = saleTotals(priced, entry.shippingCharged)
      expect(totals.total).toBe(entry.expectTotal)
    })
  }
})

describe('saleTotals', () => {
  test('splits grams sold from grams gifted', () => {
    const totals = saleTotals(
      [
        { gift: false, gramsHundredths: 350, lineTotal: 1000 },
        { gift: true, gramsHundredths: 50, lineTotal: 0 },
      ],
      0,
    )
    expect(totals.gramsSoldHundredths).toBe(350)
    expect(totals.gramsGiftedHundredths).toBe(50)
    expect(totals.goods).toBe(1000)
  })
})

describe('toHundredths', () => {
  test.each([
    ['3', 300],
    ['3.5', 350],
    ['3.05', 305],
    ['0.01', 1],
    ['10', 1000],
  ])('%s grams -> %i hundredths', (grams, expected) => {
    expect(toHundredths(grams)).toBe(expected)
  })

  test.each(['abc', '3,5', '3.555', '-3', ''])(
    'rejects %j, which parse.ts should never have let through',
    (grams) => {
      expect(() => toHundredths(grams)).toThrow()
    },
  )
})

describe('fromHundredths', () => {
  test('is the inverse of toHundredths, for display', () => {
    expect(fromHundredths(toHundredths('3.5'))).toBe(3.5)
  })
})

const NO_PAYMENT = { payState: null, method: null, total: 0 } as const

describe('validateSale', () => {
  test('flags a line with no price that day, naming the variety from the screen\'s own line', () => {
    const errors = validateSale({
      ...NO_PAYMENT,
      hasCustomer: false,
      lines: [
        { id: 'a', varietyName: 'Sativa', gift: false, specialPrice: null, quote: null },
      ],
    })
    expect(errors).toEqual([
      { field: 'line:a', message: 'Sativa has no price for that date' },
    ])
  })

  test('does not flag a gift line or a special-price line with no quote', () => {
    const errors = validateSale({
      ...NO_PAYMENT,
      hasCustomer: false,
      lines: [
        { id: 'a', varietyName: 'Sativa', gift: true, specialPrice: null, quote: null },
        { id: 'b', varietyName: 'Indica', gift: false, specialPrice: 500, quote: null },
      ],
    })
    expect(errors).toEqual([])
  })

  test('flags Debiendo with no customer', () => {
    const errors = validateSale({ ...NO_PAYMENT, payState: 'owing', hasCustomer: false, lines: [] })
    expect(errors).toEqual([
      { field: 'customer', message: 'To leave it owing, pick a customer' },
    ])
  })

  test('does not flag Debiendo once a customer is chosen', () => {
    const errors = validateSale({ ...NO_PAYMENT, payState: 'owing', hasCustomer: true, lines: [] })
    expect(errors).toEqual([])
  })

  test('does not flag a Paid sale with a method, or a sale with no state chosen', () => {
    expect(validateSale({ payState: 'paid', method: 1, total: 500, hasCustomer: false, lines: [] })).toEqual([])
    expect(validateSale({ ...NO_PAYMENT, hasCustomer: false, lines: [] })).toEqual([])
  })

  test('flags Paid above $0 with no method, on the method field', () => {
    const errors = validateSale({ payState: 'paid', method: null, total: 500, hasCustomer: false, lines: [] })
    expect(errors).toEqual([{ field: 'method' }])
  })

  test('a Paid sale of $0 needs no method', () => {
    expect(validateSale({ payState: 'paid', method: null, total: 0, hasCustomer: false, lines: [] })).toEqual([])
  })

  test('a method held under Owing is not a missing method', () => {
    expect(validateSale({ payState: 'owing', method: null, total: 500, hasCustomer: true, lines: [] })).toEqual([])
  })
})

describe('paymentChoiceOf', () => {
  test('Owing is owing, whatever method is still held', () => {
    expect(paymentChoiceOf('owing', null, 500)).toEqual({ kind: 'owing' })
    expect(paymentChoiceOf('owing', 1, 500)).toEqual({ kind: 'owing' })
  })

  test('Paid sends the chosen method', () => {
    expect(paymentChoiceOf('paid', 1, 500)).toEqual({ kind: 'paid', payment_method_id: 1 })
    expect(paymentChoiceOf('paid', 2, 500)).toEqual({ kind: 'paid', payment_method_id: 2 })
  })

  test('Paid with no method sends nothing (allowed only at $0)', () => {
    expect(paymentChoiceOf('paid', null, 0)).toBeNull()
    expect(paymentChoiceOf('paid', null, 500)).toBeNull()
  })

  test('no state chosen sends nothing, even with a method held', () => {
    expect(paymentChoiceOf(null, null, 500)).toBeNull()
    expect(paymentChoiceOf(null, 2, 500)).toBeNull()
  })
})

// The only place a bulk minimum's API grams (a JSON float, QuantityOut) may turn into
// hundredths (plan, invariants: "no Math.round, toFixed or float multiplication on
// grams"; Tech Lead review: a screen calling `toFixed` on grams is a violation).
describe('hundredthsOfApiGrams', () => {
  test('a whole number of grams', () => {
    expect(hundredthsOfApiGrams(10)).toBe(1000)
  })

  test('one and two decimal places', () => {
    expect(hundredthsOfApiGrams(0.5)).toBe(50)
    expect(hundredthsOfApiGrams(3.33)).toBe(333)
  })

  test('rejects a shape toHundredths itself would reject', () => {
    expect(() => hundredthsOfApiGrams(Number.NaN)).toThrow()
  })
})

// The type candidate, one case per way the preview can go (ADR-0059): the tie order is type,
// bulk, list, so the preview names the same rule the save records.
describe('priceLine, the Customer type candidate', () => {
  const BOTH_ON = { bulk: true, vip: true }
  const quote = (typePrice: number | null) => ({
    listPrice: 12000,
    bulk: { price: 10000, minimumHundredths: 10000 },
    vipPrice: typePrice,
  })
  const price = (over: Partial<LineInput>) =>
    priceLine({
      gift: false,
      specialPrice: null,
      customerIsVip: true,
      settings: BOTH_ON,
      quote: quote(9000),
      gramsHundredths: 5000,
      ...over,
    })

  test('the type price is lowest: the line is the type', () => {
    expect(price({})).toMatchObject({ rule: 'type', pricePerGram: 9000 })
  })

  test('the type price ties with bulk at the minimum: the line is the type', () => {
    expect(price({ quote: quote(10000), gramsHundredths: 10000 })).toMatchObject({ rule: 'type', pricePerGram: 10000 })
  })

  test('the type price above bulk at a large quantity: the line is bulk', () => {
    expect(price({ quote: quote(11000), gramsHundredths: 15000 })).toMatchObject({ rule: 'bulk', pricePerGram: 10000 })
  })

  test('a customer with no type, no customer, or the switch off: priced as list or bulk', () => {
    expect(price({ customerIsVip: false })).toMatchObject({ rule: 'list', pricePerGram: 12000 })
    expect(price({ settings: { bulk: true, vip: false } })).toMatchObject({ rule: 'list', pricePerGram: 12000 })
    expect(price({ quote: quote(null) })).toMatchObject({ rule: 'list', pricePerGram: 12000 })
  })
})

type PriceEntry = NonNullable<Variety['current_price']>

const entry = (over: Partial<PriceEntry> = {}): PriceEntry => ({
  id: 1,
  effective_from: '2026-09-01',
  list_price: 1000,
  bulk_price: null,
  bulk_minimum: null,
  vip_price: null,
  ...over,
})
const variety = (id: number, price: PriceEntry | null): Variety => ({
  id,
  name: `Variety ${id}`,
  archived: false,
  current_price: price,
})

describe('quoteOf', () => {
  test('no current price gives null', () => {
    expect(quoteOf(variety(1, null), 7)).toBeNull()
  })

  test('a bulk price without a bulk minimum, and the reverse, give no bulk', () => {
    expect(quoteOf(variety(1, entry({ bulk_price: 900 })), null)?.bulk).toBeNull()
    expect(quoteOf(variety(1, entry({ bulk_minimum: 10 })), null)?.bulk).toBeNull()
  })

  test('a bulk price with a minimum gives the minimum in hundredths', () => {
    expect(quoteOf(variety(1, entry({ bulk_price: 900, bulk_minimum: 10.05 })), null)?.bulk).toEqual({
      price: 900,
      minimumHundredths: 1005,
    })
  })

  test('a null type gives a null vipPrice even when a type has a price', () => {
    const v = variety(1, entry({ type_prices: [{ customer_type_id: 7, price: 800 }] }))
    expect(quoteOf(v, null)?.vipPrice).toBeNull()
  })

  test('a type with no price gives a null vipPrice, with type_prices omitted or empty', () => {
    expect(quoteOf(variety(1, entry()), 7)?.vipPrice).toBeNull()
    expect(quoteOf(variety(1, entry({ type_prices: [] })), 7)?.vipPrice).toBeNull()
    expect(quoteOf(variety(1, entry({ type_prices: [{ customer_type_id: 8, price: 800 }] })), 7)?.vipPrice).toBeNull()
  })

  test('a type that has a price gives that price', () => {
    const v = variety(1, entry({ type_prices: [{ customer_type_id: 7, price: 800 }] }))
    expect(quoteOf(v, 7)).toEqual({ listPrice: 1000, bulk: null, vipPrice: 800 })
  })
})

describe('priceSale', () => {
  const BOTH_ON = { bulk: true, vip: true }
  const PRODUCTS = [
    variety(
      1,
      entry({
        list_price: 1000,
        bulk_price: 900,
        bulk_minimum: 10,
        type_prices: [
          { customer_type_id: 7, price: 800 },
          { customer_type_id: 8, price: 800 },
        ],
      }),
    ),
  ]
  const line = (over: Partial<SaleLineInput> = {}): SaleLineInput => ({
    id: 'a',
    productId: 1,
    gramsHundredths: 350,
    gift: false,
    specialPrice: null,
    ...over,
  })
  const sale = (lines: SaleLineInput[], over: Partial<Parameters<typeof priceSale>[0]> = {}) =>
    priceSale({
      lines,
      customerTypeId: null,
      pricingSettings: BOTH_ON,
      products: PRODUCTS,
      shippingCharged: 0,
      ...over,
    })

  test('a Special price on an unknown product is priced at its total', () => {
    const result = sale([line({ productId: 99, specialPrice: 5000 })])
    expect(result.lines[0]?.pricing).toMatchObject({ rule: 'special', lineTotal: 5000, customerTypeId: null })
    expect(result.totals.goods).toBe(5000)
  })

  test('a Gift on an unknown product gives gift, $0', () => {
    const result = sale([line({ productId: 99, gift: true })])
    expect(result.lines[0]?.pricing).toEqual({ rule: 'gift', pricePerGram: 0, lineTotal: 0, customerTypeId: null })
    expect(result.totals).toMatchObject({ goods: 0, gramsGiftedHundredths: 350 })
  })

  test('a list line on an unknown product gives null and adds 0', () => {
    const result = sale([line({ productId: 99 })])
    expect(result.lines[0]).toEqual({ id: 'a', gift: false, gramsHundredths: 350, pricing: null })
    expect(result.totals).toMatchObject({ goods: 0, gramsSoldHundredths: 0, gramsGiftedHundredths: 0 })
  })

  test('an unpriced line keeps its grams but adds none to the totals', () => {
    const result = sale([line({ id: 'a' }), line({ id: 'b', productId: 99, gramsHundredths: 500 })])
    expect(result.lines[1]?.gramsHundredths).toBe(500)
    expect(result.totals.gramsSoldHundredths).toBe(350)
    expect(result.totals.goods).toBe(result.lines[0]?.pricing?.lineTotal)
  })

  test('a Gift with 0 grams gives null pricing and no gifted grams', () => {
    const result = sale([line({ gift: true, gramsHundredths: 0 })])
    expect(result.lines[0]?.pricing).toBeNull()
    expect(result.totals.gramsGiftedHundredths).toBe(0)
  })

  test('a malformed bulk minimum makes it throw, not a null line', () => {
    const bad = [variety(1, entry({ bulk_price: 900, bulk_minimum: 1e21 }))]
    expect(() => sale([line()], { products: bad })).toThrow(Error)
    expect(() => sale([line()], { products: bad })).not.toThrow(NoPriceThatDay)
  })

  test('totals include shipping', () => {
    const result = sale([line()], { shippingCharged: 1500 })
    expect(result.totals).toMatchObject({ shippingCharged: 1500, goods: 3500, total: 5000 })
  })

  test('a typed customer with the switch off gives list and a null type', () => {
    const result = sale([line()], { customerTypeId: 7, pricingSettings: { bulk: true, vip: false } })
    expect(result.lines[0]?.pricing).toMatchObject({ rule: 'list', customerTypeId: null })
  })

  const TABLE: { name: string; settings: { bulk: boolean; vip: boolean }; typeId: number | null; grams: number }[] = [
    { name: 'no rules, typed customer', settings: { bulk: false, vip: false }, typeId: 7, grams: 350 },
    { name: 'both on, with a type', settings: BOTH_ON, typeId: 7, grams: 350 },
    { name: 'both on, without a type', settings: BOTH_ON, typeId: null, grams: 350 },
    { name: 'a bulk line at its minimum, no type', settings: BOTH_ON, typeId: null, grams: 1000 },
    { name: 'a bulk line at its minimum, with a type', settings: BOTH_ON, typeId: 7, grams: 1000 },
  ]
  test.each(TABLE)('agrees with priceLine: $name', ({ settings, typeId, grams }) => {
    const product = PRODUCTS[0] as Variety
    const direct = priceLine({
      gift: false,
      specialPrice: null,
      customerIsVip: typeId !== null,
      settings,
      quote: quoteOf(product, typeId),
      gramsHundredths: grams,
    })
    const result = sale([line({ gramsHundredths: grams })], { customerTypeId: typeId, pricingSettings: settings })
    expect(result.lines[0]?.pricing).toEqual({
      ...direct,
      customerTypeId: direct.rule === 'type' ? typeId : null,
    })
  })
})

describe('linesRepriced', () => {
  type Pricing = NonNullable<PricedSaleLine['pricing']>
  const pricing = (over: Partial<Pricing> = {}): Pricing => ({
    rule: 'list',
    pricePerGram: 1000,
    lineTotal: 1000,
    customerTypeId: null,
    ...over,
  })
  const priced = (id: string, p: Pricing | null): PricedSaleLine => ({
    id,
    gift: p?.rule === 'gift',
    gramsHundredths: 100,
    pricing: p,
  })
  const result = (...lines: PricedSaleLine[]): PricedSale => ({
    lines,
    totals: saleTotals([], 0),
  })
  const typed = (typeId: number, price = 800) =>
    pricing({ rule: 'type', pricePerGram: price, customerTypeId: typeId })

  test('a line added or removed is not compared', () => {
    expect(linesRepriced(result(priced('a', pricing())), result(priced('a', pricing()), priced('b', typed(7))))).toBe(false)
    expect(linesRepriced(result(priced('a', pricing()), priced('b', typed(7))), result(priced('a', pricing())))).toBe(false)
  })

  test('lines are matched by id, not by position', () => {
    const before = result(priced('a', pricing()), priced('b', typed(7)))
    const after = result(priced('b', typed(7)), priced('a', pricing()))
    expect(linesRepriced(before, after)).toBe(false)
    expect(linesRepriced(before, result(priced('b', pricing()), priced('a', pricing())))).toBe(true)
  })

  test('a line becoming unpriced is not compared', () => {
    expect(linesRepriced(result(priced('a', pricing())), result(priced('a', null)))).toBe(false)
  })

  test('type A to type B at the same price is repriced', () => {
    expect(linesRepriced(result(priced('a', typed(7))), result(priced('a', typed(8))))).toBe(true)
  })

  test('the same type at the same price is not', () => {
    expect(linesRepriced(result(priced('a', typed(7))), result(priced('a', typed(7))))).toBe(false)
  })

  test('list to Special is not compared', () => {
    const special = pricing({ rule: 'special', pricePerGram: 500, lineTotal: 500 })
    expect(linesRepriced(result(priced('a', pricing())), result(priced('a', special)))).toBe(false)
  })

  test('a Gift kept and a Special kept are not compared', () => {
    const gift = pricing({ rule: 'gift', pricePerGram: 0, lineTotal: 0 })
    const special = pricing({ rule: 'special', pricePerGram: 500, lineTotal: 500 })
    const other = pricing({ rule: 'special', pricePerGram: 600, lineTotal: 500 })
    expect(linesRepriced(result(priced('a', gift), priced('b', special)), result(priced('a', gift), priced('b', other)))).toBe(false)
  })

  test('a price change is repriced', () => {
    expect(linesRepriced(result(priced('a', pricing())), result(priced('a', pricing({ pricePerGram: 1100 }))))).toBe(true)
  })

  test('list to bulk is repriced', () => {
    const bulk = pricing({ rule: 'bulk', pricePerGram: 900 })
    expect(linesRepriced(result(priced('a', pricing())), result(priced('a', bulk)))).toBe(true)
  })

  test('type to bulk is repriced', () => {
    const bulk = pricing({ rule: 'bulk', pricePerGram: 800 })
    expect(linesRepriced(result(priced('a', typed(7))), result(priced('a', bulk)))).toBe(true)
  })

  test('type to list because the switch turned off is repriced', () => {
    const product = variety(1, entry({ type_prices: [{ customer_type_id: 7, price: 800 }] }))
    const run = (vip: boolean) =>
      priceSale({
        lines: [{ id: 'a', productId: 1, gramsHundredths: 350, gift: false, specialPrice: null }],
        customerTypeId: 7,
        pricingSettings: { bulk: false, vip },
        products: [product],
        shippingCharged: 0,
      })
    expect(linesRepriced(run(true), run(false))).toBe(true)
    expect(linesRepriced(run(true), run(true))).toBe(false)
  })
})
