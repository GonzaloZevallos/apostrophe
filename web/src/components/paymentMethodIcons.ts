/**
 * The six neutral icons a payment method can carry, keyed by the string that travels on the
 * wire (`icon`). A screen renders one as `<Icono {...paymentMethodIcons[method.icon]} />`:
 * decorative, because the method's name always sits beside it. Neutral shapes only.
 */

import type { IconoProps } from './Icono'

export type PaymentMethodIcon = 'wallet' | 'bank' | 'card' | 'coins' | 'phone' | 'generic'

export const paymentMethodIcons: Record<PaymentMethodIcon, IconoProps> = {
  wallet: { nombre: 'wallet' },
  bank: { nombre: 'bank' },
  card: { nombre: 'card' },
  coins: { nombre: 'coins' },
  phone: { nombre: 'phone' },
  generic: { nombre: 'generic' },
}

/** The icon props for a method's wire key; a key this front does not know draws the generic one. */
export function iconOfMethod(key: string): IconoProps {
  return Object.hasOwn(paymentMethodIcons, key) ? paymentMethodIcons[key as PaymentMethodIcon] : paymentMethodIcons.generic
}
