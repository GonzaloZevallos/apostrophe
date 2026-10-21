/** The shell words that are not a named message. */

import type { LimitedCopy } from './limits.ts'

export const LANGUAGE: 'es' | 'en' = 'en'

export const LIMITED_COPY: readonly LimitedCopy[] = []
export const LONG_REFUSALS: readonly string[] = []

/** Every text a person reads in this area that is not a named message above, by key. */
export const SHELL_TEXT = {
  navigation: 'Navigation',
  sale: 'Sale',
  customer: 'Customer',
  newExpense: 'New expense',
  gettingStarted: 'Getting started',
} as const
