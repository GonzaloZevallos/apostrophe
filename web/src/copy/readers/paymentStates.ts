/**
 * The words of the two payment states, Paid and Owing, a getter per state backed by the i18next
 * instance (`i18n/instanceText.ts`): a caller reads them in render, never at load. They live under
 * `copy/readers/` for the same reason `customerTypeIcons.ts` does: the words are the
 * `common:paid` and `common:owing` keys, and this module holds none of its own.
 */

import { instanceText } from '../../i18n/instanceText.ts'

/** The state of "how paid" in a sale; `components/fixedSets.ts` types its set with it. */
export type PaymentStateName = 'paid' | 'owing'

export const PAYMENT_STATE_NAME: Readonly<Record<PaymentStateName, () => string>> = {
  paid: () => instanceText('common:paid'),
  owing: () => instanceText('common:owing'),
}
