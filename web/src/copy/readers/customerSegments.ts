/**
 * The words of Customers' two segments, All and Owed, a getter per segment backed by the i18next
 * instance (`i18n/instanceText.ts`): a caller reads them in render, never at load. They live
 * under `copy/readers/` for the same reason `homeViews.ts` does: the words are the
 * `common:customerSegmentAll` and `common:owedToYou` keys, and this module holds none of its own.
 */

import { instanceText } from '../../i18n/instanceText.ts'

/** The two segments of Customers; `components/fixedSets.ts` types its set with it. */
export type CustomerSegmentName = 'all' | 'owed'

export const CUSTOMER_SEGMENT_NAME: Readonly<Record<CustomerSegmentName, () => string>> = {
  all: () => instanceText('common:customerSegmentAll'),
  owed: () => instanceText('common:owedToYou'),
}
