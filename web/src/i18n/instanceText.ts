/**
 * A text read straight from the i18next instance by key, for a holder that is not a component
 * and so cannot call `useTranslation`: a `copy/` reader (`CUSTOMER_TYPE_ICON_NAME` in
 * `copy/readers/customerTypeIcons.ts`) calls it from a getter that runs in render. It is a pure read: no
 * init, no subscription, and it answers in whatever language the instance shows at that moment.
 */

import i18n from 'i18next'
import type { CopyKey } from './resources.generated.ts'

/** The keys a `copy/` reader hands over: today the customer-type icon names. */
export type InstanceTextKey = Exclude<
  Extract<CopyKey, `customerTypes:icon.${string}`>,
  'customerTypes:icon.label'
>

export function instanceText(key: InstanceTextKey): string {
  return i18n.t(key)
}
