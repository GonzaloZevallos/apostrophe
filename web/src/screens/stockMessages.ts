/** The fixed Spanish of the stock entry form and the entries list that is always on
 * screen: help lines, the preview line and the empty state. The screens render these
 * same bindings, and `LIMITED_COPY` lists them for `copy/copyLimits.test.ts`, which
 * measures each with `SAMPLES` (never fixture or API data). */

import { SAMPLES, type LimitedCopy } from '../copy/limits'
import { formatGrams, formatMoney } from '../format/money'

export const EMPTY_STATE_TITLE = 'Sin entradas de stock'
export const EMPTY_STATE_DETAIL = 'Cargá tu stock inicial o una compra'

export const COST_REQUIRED_HELP = 'Obligatorio cuando es una compra'

/** The grams on hand under the variety picker; `grams` is what the API answered. */
export function onHandHelp(grams: number): string {
  return `Hoy tiene ${formatGrams(grams)}`
}

/** The per-gram cost previewed while typing; `perGram` is the front's preview. */
export function perGramPreview(perGram: number): string {
  return `Te queda en ${formatMoney(perGram)} el gramo`
}

/** Checked by `copy/copyLimits.test.ts`: placeholders filled from `SAMPLES`. */
export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyTitle', text: EMPTY_STATE_TITLE },
  { kind: 'emptyLine', text: EMPTY_STATE_DETAIL },
  { kind: 'help', text: COST_REQUIRED_HELP },
  { kind: 'help', text: `Hoy tiene ${SAMPLES.grams}` },
  { kind: 'help', text: `Te queda en ${SAMPLES.amount} el gramo` },
]
export const LONG_REFUSALS: readonly string[] = []
