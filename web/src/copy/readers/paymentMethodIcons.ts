/**
 * The accessible name of each payment-method icon, a getter per key backed by the i18next
 * instance (`i18n/instanceText.ts`): a caller reads it in render, never at load. Like
 * `customerTypeIcons.ts` it lives under `copy/readers/` and holds no text of its own: the words
 * are the `paymentMethods:icon.*` keys. The names say what is drawn (a banknote, a card, a
 * phone), never a country, a bank or a brand.
 */

import { instanceText } from '../../i18n/instanceText.ts'

/** The closed set of icon keys, the same as the backend's `PaymentMethodIcon`. */
export const PAYMENT_METHOD_ICON_KEYS = ['banknote', 'coins', 'card', 'bank', 'phone', 'wallet', 'qr', 'other'] as const

export type PaymentMethodIconKey = (typeof PAYMENT_METHOD_ICON_KEYS)[number]

export const PAYMENT_METHOD_ICON_NAME: Readonly<Record<PaymentMethodIconKey, () => string>> = {
  banknote: () => instanceText('paymentMethods:icon.banknote'),
  coins: () => instanceText('paymentMethods:icon.coins'),
  card: () => instanceText('paymentMethods:icon.card'),
  bank: () => instanceText('paymentMethods:icon.bank'),
  phone: () => instanceText('paymentMethods:icon.phone'),
  wallet: () => instanceText('paymentMethods:icon.wallet'),
  qr: () => instanceText('paymentMethods:icon.qr'),
  other: () => instanceText('paymentMethods:icon.other'),
}
