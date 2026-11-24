/** The products copy keys, resolved through the i18n instance in `en` and in `en-XA`. */

import i18n from 'i18next'
import { afterEach, expect, test } from 'vitest'
import { installLocale } from '../../i18n'
import { PRODUCTS_SEGMENT_LABEL, PRODUCTS_SEGMENT_NAME } from './productsSegments'

afterEach(async () => {
  await i18n.changeLanguage('en')
})

test('the three keys resolve in English', () => {
  expect(PRODUCTS_SEGMENT_NAME.catalog()).toBe('Catalog')
  expect(PRODUCTS_SEGMENT_NAME.stock()).toBe('Stock')
  expect(PRODUCTS_SEGMENT_LABEL()).toBe('Products view')
})

test('the three keys resolve in en-XA, to a pseudo-localised text that is not the English one', async () => {
  await installLocale('en-XA')
  await i18n.changeLanguage('en-XA')
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
