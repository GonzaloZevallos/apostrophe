/** `productCount`: the one count of lines with a Product chosen (the strip's N and the toast). */

import { expect, test } from 'vitest'
import type { LineState } from './NuevaVentaLinea'
import { productCount } from './saleLineCount'

function line(patch: Partial<LineState>): LineState {
  return { key: 'k', varietyId: '', varietyName: '', grams: '', gift: false, specialPrice: '', ...patch }
}

test('a blank line counts 0', () => {
  expect(productCount([line({})])).toBe(0)
})

test('a line with a Product counts, whatever its grams', () => {
  expect(productCount([line({ varietyId: '1' }), line({ varietyId: '2', grams: '3,5' })])).toBe(2)
})

test('a Gift line with a Product counts', () => {
  expect(productCount([line({ varietyId: '1', grams: '2', gift: true })])).toBe(1)
})

test('a Special-price line with a Product counts', () => {
  expect(productCount([line({ varietyId: '1', grams: '2', specialPrice: '500' })])).toBe(1)
})

test('grams with no Product count 0', () => {
  expect(productCount([line({ grams: '5' }), line({ gift: true }), line({ specialPrice: '300' })])).toBe(0)
})
