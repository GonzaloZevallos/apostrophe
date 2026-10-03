/**
 * The front's own mirror of `app/stock/domain/costing.cost_per_gram` (plan,
 * invariants: "An entry's displayed cost_per_gram comes only from
 * app/stock/domain/costing.cost_per_gram (and its front mirror tested on the shared
 * vectors)"). Used only for `EntradaStock`'s preview ("Te queda en $ 8.500 el gramo"),
 * before an entry exists and the API has an answer of its own — every other screen
 * shows the API's own `cost_per_gram`, never recomputes it.
 *
 * No float division, no `Math.round` on anything but an integer ratio: integer
 * hundredths in, a half-up integer peso out, exactly the backend's formula.
 */

const HUNDREDTHS_PER_GRAM = 100

/** `"11.5"` or `"11,5"` → `1150`. Assumes `parseGrams`'s own shape: digits, at most
 * one separator, at most two decimal digits — split on the separator and pad the
 * fraction, never multiply a parsed float by 100. */
export function gramsToHundredths(grams: string): number {
  const [whole = '0', fraction = ''] = grams.replace(',', '.').split('.')
  const paddedFraction = (fraction + '00').slice(0, 2)
  return Number(whole) * HUNDREDTHS_PER_GRAM + Number(paddedFraction)
}

/** `totalCost` (whole pesos) over `gramsHundredths`, rounded half up — the same
 * formula as `cost_per_gram` in `app/stock/domain/costing.py`. `gramsHundredths` must
 * be positive. */
export function costPerGram(totalCost: number, gramsHundredths: number): number {
  const numerator = 2 * totalCost * HUNDREDTHS_PER_GRAM + gramsHundredths
  return Math.floor(numerator / (2 * gramsHundredths))
}
