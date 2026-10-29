/**
 * `saleGrams` at its own seam (CODING_STANDARDS §5: a domain unit test, no
 * infrastructure). Plan, invariants: "on Ventas rows from `saleGrams`" — this is
 * the one place Ventas sums a sale's grams for display, and it must agree with
 * the API's own `total_quantity` (`SaleDetail`), never drift from it.
 */

import { expect, test } from 'vitest'
import saleDetailFixture from '../api/fixtures/sale-detail.json'
import saleDetailGiftFixture from '../api/fixtures/sale-detail-gift.json'
import { saleGrams } from './grams'

test('equals the API detail fixture\'s total_quantity on its one line', () => {
  expect(saleGrams(saleDetailFixture.lines)).toBe(saleDetailFixture.total_quantity)
})

test('equals the API detail fixture\'s total_quantity with a gift line and a variety repeated across two lines', () => {
  // `sale-detail-gift.json`: Blue Dream twice (2 g, 1.5 g) plus a 1 g OG Kush
  // gift — the API's own `total_quantity` is 4.5, summed server-side the same way
  // `line_total`/`total` already are; this only checks the two never drift.
  expect(saleGrams(saleDetailGiftFixture.lines)).toBe(saleDetailGiftFixture.total_quantity)
})
