/** The fixed Spanish of the sale screens that is always on screen: the empty list of
 * Ventas, the hint under the disabled Debiendo and the line that has no price for its
 * date. Each binding is the one its screen renders (`pricing.ts` builds the message
 * from `noPriceMessage`), registered here and measured with `SAMPLES` by
 * `copy/copyLimits.test.ts`, never with fixture or API data. */

import { SAMPLES, type LimitedCopy } from './limits'
import { EMPTY_STATES } from './emptyStates'

export const EMPTY_LIST = EMPTY_STATES.salesList
export const GRAMS_HELP = 'Coma, hasta dos decimales'
export const OWING_HINT = 'Para dejar debiendo elegí un cliente'

/** The line of a variety with no price on the sale's date. */
export function noPriceMessage(varietyName: string): string {
  return `${varietyName} no tiene precio para esa fecha`
}

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyLine', text: EMPTY_LIST },
  { kind: 'help', text: OWING_HINT },
  { kind: 'help', text: GRAMS_HELP },
  { kind: 'help', text: noPriceMessage(SAMPLES.name) },
]

/** Nothing here is over 80 characters. */
export const LONG_REFUSALS: readonly string[] = []
