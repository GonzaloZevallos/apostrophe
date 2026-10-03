import { describe, expect, test } from 'vitest'
import matrix from './pricing-matrix.json'
import {
  GiftWithSpecialPrice,
  InvalidSpecialPrice,
  NonPositiveGrams,
  NoPriceThatDay,
  type LineInput,
  type PricingRule,
  fromHundredths,
  priceLine,
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
        expect(result.rule).toBe(line.expect.rule as PricingRule)
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
        expect(results.map((r) => r.rule)).toEqual(entry.expectRules)
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

describe('validateSale', () => {
  test('flags a line with no price that day, naming the variety from the screen\'s own line', () => {
    const errors = validateSale({
      method: null,
      hasCustomer: false,
      lines: [
        { id: 'a', varietyName: 'Sativa', gift: false, specialPrice: null, quote: null },
      ],
    })
    expect(errors).toEqual([
      { field: 'line:a', message: 'Sativa no tiene precio para esa fecha' },
    ])
  })

  test('does not flag a gift line or a special-price line with no quote', () => {
    const errors = validateSale({
      method: null,
      hasCustomer: false,
      lines: [
        { id: 'a', varietyName: 'Sativa', gift: true, specialPrice: null, quote: null },
        { id: 'b', varietyName: 'Indica', gift: false, specialPrice: 500, quote: null },
      ],
    })
    expect(errors).toEqual([])
  })

  test('flags Debiendo with no customer', () => {
    const errors = validateSale({ method: 'owing', hasCustomer: false, lines: [] })
    expect(errors).toEqual([
      { field: 'customer', message: 'Para dejar debiendo elegí un cliente' },
    ])
  })

  test('does not flag Debiendo once a customer is chosen', () => {
    const errors = validateSale({ method: 'owing', hasCustomer: true, lines: [] })
    expect(errors).toEqual([])
  })

  test('does not flag cash or transfer, with or without a customer', () => {
    expect(validateSale({ method: 'cash', hasCustomer: false, lines: [] })).toEqual([])
    expect(validateSale({ method: null, hasCustomer: false, lines: [] })).toEqual([])
  })
})
