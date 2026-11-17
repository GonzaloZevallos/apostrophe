/** The payment-method icon lookup (key -> glyph, accessible name) against the backend's closed list. */

import { expect, test } from 'vitest'
import { ICON_NAMES } from './Icono'
import enPaymentMethods from '../copy/locales/en/paymentMethods.json'
import {
  DEFAULT_PAYMENT_METHOD_ICON,
  PAYMENT_METHOD_ICON_ORDER,
  isPaymentMethodIcon,
  paymentMethodGlyph,
  paymentMethodIconKey,
  paymentMethodIconName,
} from './paymentMethodIcons'

/** The backend's `PaymentMethodIcon` keys, as the plan states them (the hexagon owns the enum). */
const BACKEND_KEYS = ['banknote', 'coins', 'card', 'bank', 'phone', 'wallet', 'qr', 'other']

const sorted = (keys: readonly string[]): string[] => [...keys].sort()

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right))
}

test('the key list is the backend list, and the copy names exactly those keys', () => {
  expect(sameSet(PAYMENT_METHOD_ICON_ORDER, BACKEND_KEYS)).toBe(true)
  expect(sameSet(Object.keys(enPaymentMethods.icon), BACKEND_KEYS)).toBe(true)
})

test('the comparison rejects a list missing a key or holding an extra one', () => {
  expect(sameSet(PAYMENT_METHOD_ICON_ORDER.filter((key) => key !== 'qr'), BACKEND_KEYS)).toBe(false)
  expect(sameSet([...PAYMENT_METHOD_ICON_ORDER, 'bitcoin'], BACKEND_KEYS)).toBe(false)
})

test.each(BACKEND_KEYS)('%s has its own glyph drawn by Icono and a non-empty name', (key) => {
  expect(ICON_NAMES).toContain(paymentMethodGlyph(key))
  expect(paymentMethodIconName(key)).not.toBe('')
})

test('every key draws a different glyph', () => {
  const glyphs = BACKEND_KEYS.map((key) => paymentMethodGlyph(key))
  expect(new Set(glyphs).size).toBe(BACKEND_KEYS.length)
})

test('an unknown key falls back to other, in glyph, key and name', () => {
  expect(isPaymentMethodIcon('hologram')).toBe(false)
  expect(isPaymentMethodIcon('card')).toBe(true)
  expect(DEFAULT_PAYMENT_METHOD_ICON).toBe('other')
  expect(paymentMethodIconKey('hologram')).toBe('other')
  expect(paymentMethodGlyph('hologram')).toBe(paymentMethodGlyph('other'))
  expect(paymentMethodIconName('hologram')).toBe(paymentMethodIconName('other'))
})

test('no name carries a flower word', () => {
  const flowerWords = /variety|gram|indica|sativa|aroma|strain|🌿|\bg\b/i
  for (const key of BACKEND_KEYS) expect(paymentMethodIconName(key)).not.toMatch(flowerWords)
})
