/**
 * The Customer type icons: every key of the API's `CustomerTypeIcon` enum mapped to a glyph and
 * its accessible name. The glyph is a plain text symbol (never an emoji: `architecture/noEmoji.real.test.ts`) and decorative wherever it shows (the type's name is always
 * beside it); `icons.test.ts` checks the map against the OpenAPI snapshot, so an icon the
 * server adds without a glyph here fails the build.
 */

import type { CustomerTypeIconKey } from '../api/customerTypes'
import { CUSTOMERS_TEXT } from '../copy/customers'

export interface CustomerTypeGlyph {
  glyph: string
  name: string
}

export const CUSTOMER_TYPE_ICONS: Record<CustomerTypeIconKey, CustomerTypeGlyph> = {
  circle: { glyph: '●', name: CUSTOMERS_TEXT.typeIconCircle },
  star: { glyph: '★', name: CUSTOMERS_TEXT.typeIconStar },
  heart: { glyph: '♡', name: CUSTOMERS_TEXT.typeIconHeart },
  diamond: { glyph: '◆', name: CUSTOMERS_TEXT.typeIconDiamond },
  flag: { glyph: '⚑', name: CUSTOMERS_TEXT.typeIconFlag },
  tag: { glyph: '◈', name: CUSTOMERS_TEXT.typeIconTag },
  crown: { glyph: '♛', name: CUSTOMERS_TEXT.typeIconCrown },
  bell: { glyph: '✦', name: CUSTOMERS_TEXT.typeIconBell },
}

export function glyphOf(icon: CustomerTypeIconKey): string {
  return CUSTOMER_TYPE_ICONS[icon].glyph
}
