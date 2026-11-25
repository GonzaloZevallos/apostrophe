/** The products copy keys, resolved through the i18n instance in `en` and in `en-XA`. */

import { afterEach, expect, test } from 'vitest'
import { applyShownLanguage, resetToBootLanguage } from '../../i18n/language'
import { PRODUCTS_SEGMENT_LABEL, PRODUCTS_SEGMENT_NAME } from './productsSegments'

afterEach(async () => {
  await applyShownLanguage('en')
  resetToBootLanguage()
})

test('the three keys resolve in English', () => {
  expect(PRODUCTS_SEGMENT_NAME.catalog()).toBe('Catalog')
  expect(PRODUCTS_SEGMENT_NAME.stock()).toBe('Stock')
  expect(PRODUCTS_SEGMENT_LABEL()).toBe('Products view')
})

test('the three keys resolve in en-XA, to a pseudo-localised text that is not the English one', async () => {
  await applyShownLanguage('en-XA')
  for (const [text, english] of [
    [PRODUCTS_SEGMENT_NAME.catalog(), 'Catalog'],
    [PRODUCTS_SEGMENT_NAME.stock(), 'Stock'],
    [PRODUCTS_SEGMENT_LABEL(), 'Products view'],
  ] as const) {
    expect(text).toMatch(/^⟦.+⟧$/)
    expect(text).not.toBe(english)
    expect(text).not.toMatch(/^products:/)
  }
})
