/**
 * The cost of one gram (one stock unit) from what an entry cost in minor units and its
 * quantity in hundredths: `costPerGram`'s half-up rule, with every product checked to be a
 * safe integer before it is computed. This is the only place a cost per unit is computed from
 * `MinorUnits` and `Hundredths`, and the guard `toMinorUnits` leaves to it.
 */

import type { MinorUnits } from '../format/parse'
import type { Hundredths } from './stockUnit'

const HUNDREDTHS_PER_UNIT = 100

/** `costMinor` over `quantity`, rounded half up: `floor((2 * costMinor * 100 + q) / (2 * q))`.
 * `null` when the cost is not a safe integer >= 0, when the quantity is not a safe integer > 0,
 * when the cost is above the last one whose numerator stays a safe integer (checked before any
 * arithmetic), or when the result is 0. */
export function unitCost(costMinor: MinorUnits, quantity: Hundredths): number | null {
  if (!Number.isSafeInteger(costMinor) || costMinor < 0) return null
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return null
  if (costMinor > Math.floor((Number.MAX_SAFE_INTEGER - quantity) / (2 * HUNDREDTHS_PER_UNIT))) return null
  const perUnit = Math.floor((2 * costMinor * HUNDREDTHS_PER_UNIT + quantity) / (2 * quantity))
  return perUnit === 0 ? null : perUnit
}
