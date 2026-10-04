/**
 * `saleGrams` at its own seam (CODING_STANDARDS §5: a domain unit test, no
 * infrastructure). Plan, invariants: "on Ventas rows from `saleGrams`" — this is
 * the one place Ventas sums a sale's grams for display, and it must agree with
 * the API's own `total_grams` (`SaleDetail`), never drift from it.
 */

import { expect, test } from 'vitest'
import saleDetailFixture from '../api/fixtures/sale-detail.json'
import { saleGrams } from './grams'

test('equals the API detail fixture\'s total_grams on its one line', () => {
  expect(saleGrams(saleDetailFixture.lines)).toBe(saleDetailFixture.total_grams)
})

test('sums every line, a gift included, and a variety repeated across two lines counted twice', () => {
  const lines = [
    { variety_id: 1, variety_name: 'Blue Dream', grams: 2, pricing_rule: 'list' as const, price_per_gram: 1000, line_total: 2000 },
    { variety_id: 1, variety_name: 'Blue Dream', grams: 1.5, pricing_rule: 'list' as const, price_per_gram: 1000, line_total: 1500 },
    { variety_id: 2, variety_name: 'OG Kush', grams: 1, pricing_rule: 'gift' as const, price_per_gram: 0, line_total: 0 },
  ]

  expect(saleGrams(lines)).toBe(4.5)
})
