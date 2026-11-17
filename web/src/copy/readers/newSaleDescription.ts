/**
 * The description of the bar's +, the one sentence about what New sale also records, backed by the
 * i18next instance (`i18n/instanceText.ts`): a caller reads it in render, never at load. It lives
 * under `copy/readers/` for the same reason `paymentStates.ts` does: the words are the
 * `common:newSaleFabDescription` key, and this module holds none of its own.
 *
 * The parameter spells out the record lists that have a sentence: adding a record to
 * `OTHER_RECORDS` stops `describeNewSale(OTHER_RECORDS)` compiling until its sentence is written,
 * and nothing falls back to the expense one.
 */

import { instanceText } from '../../i18n/instanceText.ts'

/** `null` when there is nothing else to record, so the + has no description. */
export function describeNewSale(records: readonly [] | readonly ['expense']): string | null {
  if (records.length === 0) return null
  return instanceText('common:newSaleFabDescription')
}
