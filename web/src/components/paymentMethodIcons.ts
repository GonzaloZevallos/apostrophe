/**
 * The payment-method icons: the closed set of keys (the backend's `PaymentMethodIcon`) mapped
 * to the `Icono` glyph that draws each and its accessible name. A key the API sends that is
 * not in the set falls back to `other`, so a newer server never breaks an older screen. The
 * set is not a chip set (ADR-0074): the settings picker lists it as a closed list in its Sheet,
 * so these keys are not declared in `components/fixedSets.ts`.
 */

import type { NombreIcono } from './Icono'
import {
  PAYMENT_METHOD_ICON_KEYS,
  PAYMENT_METHOD_ICON_NAME,
  type PaymentMethodIconKey,
} from '../copy/readers/paymentMethodIcons'

export type PaymentMethodIcon = PaymentMethodIconKey

export const PAYMENT_METHOD_ICON_ORDER: readonly PaymentMethodIcon[] = PAYMENT_METHOD_ICON_KEYS

export const DEFAULT_PAYMENT_METHOD_ICON: PaymentMethodIcon = 'other'

/** Each key's drawing, one line per key: the `Icono` name a person sees on the settings rows,
 * the picker and the Selector. */
const GLYPH: Readonly<Record<PaymentMethodIcon, { icono: NombreIcono }>> = {
  banknote: { icono: 'billete' },
  coins: { icono: 'monedas' },
  card: { icono: 'tarjeta' },
  bank: { icono: 'banco' },
  phone: { icono: 'telefono' },
  wallet: { icono: 'billetera' },
  qr: { icono: 'codigoQr' },
  other: { icono: 'otro' },
}

export function isPaymentMethodIcon(key: string): key is PaymentMethodIcon {
  return (PAYMENT_METHOD_ICON_KEYS as readonly string[]).includes(key)
}

/** The key itself when it is in the set, `other` for anything else. */
export function paymentMethodIconKey(key: string): PaymentMethodIcon {
  return isPaymentMethodIcon(key) ? key : DEFAULT_PAYMENT_METHOD_ICON
}

/** The `Icono` glyph of a key; an unknown key draws `other`. */
export function paymentMethodGlyph(key: string): NombreIcono {
  return GLYPH[paymentMethodIconKey(key)].icono
}

/** The accessible name of a key, read in the language shown now; an unknown key is named `other`. */
export function paymentMethodIconName(key: string): string {
  return PAYMENT_METHOD_ICON_NAME[paymentMethodIconKey(key)]()
}
