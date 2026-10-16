/** The fixed Spanish of the stock entry form and the entries list that is always on
 * screen: help lines, the preview line and the empty state. The screens render these
 * same bindings, and `LIMITED_COPY` lists them for `copy/copyLimits.test.ts`, which
 * measures each with `SAMPLES` (never fixture or API data). */

import { SAMPLES, type LimitedCopy } from '../copy/limits'

export const EMPTY_STATE_TITLE = 'Sin entradas de stock'
export const EMPTY_STATE_DETAIL = 'Cargá tu stock inicial o una compra'

export const COST_REQUIRED_HELP = 'Obligatorio cuando es una compra'

/** The refusal of a bad grams amount, shared by the price, stock entry and withdrawal forms. */
export const GRAMS_INVALID = 'Revisá los gramos cargados'

/** The grams on hand under the variety picker; `grams` is already formatted from what
 * the API answered (`formatGrams`), so the registry can measure it with `SAMPLES.grams`. */
export function onHandHelp(grams: string): string {
  return `Hoy tiene ${grams}`
}

/** The per-gram cost previewed while typing; `perGram` is the front's preview, already
 * formatted (`formatMoney`), so the registry can measure it with `SAMPLES.amount`. */
export function perGramPreview(perGram: string): string {
  return `Te queda en ${perGram} el gramo`
}

/** Checked by `copy/copyLimits.test.ts`: placeholders filled from `SAMPLES`. */
export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyTitle', text: EMPTY_STATE_TITLE },
  { kind: 'emptyLine', text: EMPTY_STATE_DETAIL },
  { kind: 'help', text: COST_REQUIRED_HELP },
  { kind: 'help', text: GRAMS_INVALID },
  { kind: 'help', text: onHandHelp(SAMPLES.grams) },
  { kind: 'help', text: perGramPreview(SAMPLES.amount) },
]
export const LONG_REFUSALS: readonly string[] = []
