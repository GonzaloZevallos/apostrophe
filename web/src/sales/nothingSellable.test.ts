/**
 * `nothingSellable` at its own seam: the rule that says what is missing at New sale's
 * Product picker, over the Products answer for the sale's date.
 */

import { expect, test } from 'vitest'
import type { Variety } from '../screens/Variedades'
import { nothingSellable } from './nothingSellable'

const PRICE = { id: 9, effective_from: '2026-09-01', list_price: 1000, bulk_price: null, bulk_minimum: null }
const UNPRICED: Variety = { id: 1, name: 'Rosa', archived: false, current_price: null }
const PRICED: Variety = { id: 2, name: 'Lirio', archived: false, current_price: PRICE }

const TABLE: { name: string; varieties: Variety[]; expected: ReturnType<typeof nothingSellable> }[] = [
  { name: 'no products', varieties: [], expected: 'noProducts' },
  { name: 'one product without a current price', varieties: [UNPRICED], expected: 'noPrice' },
  { name: 'one priced among unpriced', varieties: [UNPRICED, PRICED, { ...UNPRICED, id: 3 }], expected: null },
  { name: 'all priced', varieties: [PRICED, { ...PRICED, id: 4 }], expected: null },
]

test.each(TABLE)('$name', ({ varieties, expected }) => {
  expect(nothingSellable(varieties)).toBe(expected)
})
