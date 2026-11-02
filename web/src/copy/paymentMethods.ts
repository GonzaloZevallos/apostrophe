/**
 * The payment-method words of the pickers (New sale, Record payment). The names of the methods
 * themselves are the seller's data and never live here. Settings adds its own keys to this
 * section as it grows.
 */

import type { LimitedCopy } from './limits.ts'

export const LANGUAGE: 'es' | 'en' = 'en'

export const LONG_REFUSALS: readonly string[] = []

/** Every text a person reads about payment methods, by key. */
export const PAYMENT_METHODS_TEXT = {
  /** The accessible name of the group of chips. */
  methodGroupLabel: 'Payment method',
  /** The accessible name of the placeholder while the list loads. */
  methodsLoading: 'Loading payment methods',
  /** The notice after a save was refused for a method that is gone. */
  errorMethodUnavailable: "That payment method isn't available any more. Pick another one.",
} as const

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'notice', text: PAYMENT_METHODS_TEXT.errorMethodUnavailable },
]
