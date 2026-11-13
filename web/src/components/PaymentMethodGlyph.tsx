/**
 * The glyph of a payment-method icon key. The method's name always sits beside it, so by default
 * it is decorative (no accessible name, nothing announced twice); `named` gives the glyph its
 * own accessible name where no name is beside it, as in the settings icon picker.
 */

import Icono from './Icono'
import { paymentMethodGlyph, paymentMethodIconName } from './paymentMethodIcons'

export interface PaymentMethodGlyphProps {
  icon: string
  named?: boolean
}

export default function PaymentMethodGlyph({ icon, named = false }: PaymentMethodGlyphProps) {
  return <Icono nombre={paymentMethodGlyph(icon)} label={named ? paymentMethodIconName(icon) : undefined} />
}
