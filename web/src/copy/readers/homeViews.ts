/**
 * The words of Home's two views, Home and Analysis, a getter per view backed by the i18next
 * instance (`i18n/instanceText.ts`): a caller reads them in render, never at load. They live under
 * `copy/readers/` for the same reason `paymentStates.ts` does: the words are the
 * `common:homeSegmentHome` and `common:homeSegmentAnalysis` keys, and this module holds none of
 * its own.
 */

import { instanceText } from '../../i18n/instanceText.ts'

/** The two views of Home; `components/fixedSets.ts` types its set with it. */
export type HomeViewName = 'home' | 'analysis'

export const HOME_VIEW_NAME: Readonly<Record<HomeViewName, () => string>> = {
  home: () => instanceText('common:homeSegmentHome'),
  analysis: () => instanceText('common:homeSegmentAnalysis'),
}
