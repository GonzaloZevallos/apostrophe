/**
 * The accessible name of each customer-type icon, a getter per key backed by the i18next
 * instance (`i18n/instanceText.ts`): it reads the language shown at the moment it is called,
 * so a caller calls it in render, never at load. It lives under `copy/readers/`, not among the
 * copy files, because it holds no text of its own: the words are the `customerTypes:icon.*`
 * keys, and the copy files' guards walk their own exported texts.
 */

import { instanceText } from '../../i18n/instanceText.ts'

/** The icon keys of `customerTypes:icon.*`; `components/fixedSets.ts` types its set with them. */
export type CustomerTypeIconName = 'circle' | 'star' | 'heart' | 'diamond' | 'flag' | 'tag' | 'crown' | 'bell'

export const CUSTOMER_TYPE_ICON_NAME: Readonly<Record<CustomerTypeIconName, () => string>> = {
  circle: () => instanceText('customerTypes:icon.circle'),
  star: () => instanceText('customerTypes:icon.star'),
  heart: () => instanceText('customerTypes:icon.heart'),
  diamond: () => instanceText('customerTypes:icon.diamond'),
  flag: () => instanceText('customerTypes:icon.flag'),
  tag: () => instanceText('customerTypes:icon.tag'),
  crown: () => instanceText('customerTypes:icon.crown'),
  bell: () => instanceText('customerTypes:icon.bell'),
}
