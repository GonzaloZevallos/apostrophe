import { formatGrams } from '../../format/money'
import { ANALYSIS_TEXT } from '../../copy/analysis'

/** " and N g without cost" (PM, round 1): never shown for a figure with nothing pending. */
export function pendingSuffix(grams: number): string {
  return grams > 0 ? ANALYSIS_TEXT.pendingSuffix(formatGrams(grams)) : ''
}
