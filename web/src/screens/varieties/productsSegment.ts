/**
 * The only reader and writer of the phone Products tab's segment (Catalog | Stock) in history
 * state (`location.state`), under the one entry `productsSegment`. It is a history-state writer
 * beside `components/feedback.ts` (the feedback markers) and `components/inAppState.ts` (`inApp`
 * and `from`): each is the only writer of its own keys. The segment is never in a path, a query or
 * device storage, and its values come only from `PRODUCTS_SEGMENTS` (`components/fixedSets.ts`).
 *
 * `withSegment` keeps every other key of the state it is given and never writes `inApp` or `from`:
 * a new entry is built with `inAppState(location, withSegment(state, segment))`, and the current
 * one is replaced with `withSegment(location.state, segment)` alone.
 */

import { type FixedValue, PRODUCTS_SEGMENTS } from '../../components/fixedSets'

export type ProductsSegment = FixedValue<typeof PRODUCTS_SEGMENTS>

export const DEFAULT_PRODUCTS_SEGMENT: ProductsSegment = 'catalog'

const SEGMENT_PROPERTY = 'productsSegment'

/** A plain object: the prototype is `Object.prototype` or none (an array or a Date is not). */
function isPlainObject(state: unknown): state is Record<string, unknown> {
  if (typeof state !== 'object' || state === null) return false
  const prototype: unknown = Object.getPrototypeOf(state)
  return prototype === Object.prototype || prototype === null
}

function isSegment(value: unknown): value is ProductsSegment {
  return PRODUCTS_SEGMENTS.some((option) => option.value === value)
}

/** The segment the entry's state carries; the default when it is missing or not one of the set. */
export function readSegment(state: unknown): ProductsSegment {
  if (!isPlainObject(state)) return DEFAULT_PRODUCTS_SEGMENT
  if (!Object.hasOwn(state, SEGMENT_PROPERTY)) return DEFAULT_PRODUCTS_SEGMENT
  const value = state[SEGMENT_PROPERTY]
  return isSegment(value) ? value : DEFAULT_PRODUCTS_SEGMENT
}

/** A new state with the segment set and every other key kept; the input is never changed. */
export function withSegment(state: unknown, segment: ProductsSegment): Record<string, unknown> {
  return isPlainObject(state)
    ? { ...state, [SEGMENT_PROPERTY]: segment }
    : { [SEGMENT_PROPERTY]: segment }
}
