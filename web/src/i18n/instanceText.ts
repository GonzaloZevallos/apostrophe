/**
 * A text read straight from the i18next instance by key, for a holder that is not a component
 * and so cannot call `useTranslation`: a `copy/` reader (`CUSTOMER_TYPE_ICON_NAME` in
 * `copy/readers/customerTypeIcons.ts`) calls it from a getter that runs in render. It is a pure read: no
 * init, no subscription, and it answers in whatever language the instance shows at that moment.
 */

import i18n from 'i18next'
import type { CopyKey } from './resources.generated.ts'

/** The keys a `copy/` reader hands over: the customer-type and payment-method icon names, the payment states, Home's views, Customers' segments, Products' segments and the New sale description. */
export type InstanceTextKey =
  | Exclude<Extract<CopyKey, `customerTypes:icon.${string}`>, 'customerTypes:icon.label'>
  | Extract<CopyKey, `paymentMethods:icon.${string}`>
  | Extract<CopyKey, `products:segment.${string}`>
  | 'common:paid'
  | 'common:owing'
  | 'common:homeSegmentHome'
  | 'common:homeSegmentAnalysis'
  | 'common:customerSegmentAll'
  | 'common:owedToYou'
  | 'common:newSaleFabDescription'
  | 'payments:savePayment'
  | 'payments:savePaymentNoAmount'

/** `args` fills a key's placeholders (`payments:savePayment` takes the formatted `amount`). */
export function instanceText(key: InstanceTextKey, args?: { amount: string }): string {
  return args === undefined ? i18n.t(key) : i18n.t(key, { amount: args.amount })
}
