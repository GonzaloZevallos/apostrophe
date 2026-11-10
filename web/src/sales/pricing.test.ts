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
  hundredthsOfApiGrams,
  paymentChoiceOf,
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
    expect(paymentChoiceOf('paid', 1, 500)).toEqual({ kind: 'method', payment_method_id: 1 })
    expect(paymentChoiceOf('paid', 2, 500)).toEqual({ kind: 'method', payment_method_id: 2 })
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
