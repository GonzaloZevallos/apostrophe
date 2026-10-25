/** The payments words that are not a named message. */

import { baselineArgs } from './baselineArgs.ts'
import type * as Self from './payments.ts'
import type { LimitedCopy } from './limits.ts'

export const LANGUAGE: 'es' | 'en' = 'en'

export const LIMITED_COPY: readonly LimitedCopy[] = []
export const LONG_REFUSALS: readonly string[] = []

const M = '$ 11.000'
const D = '28/09'

/** The fixture arguments of this file's functions, for `en.baseline.json` (`./baselineArgs.ts`). */
export const BASELINE_ARGS = baselineArgs<typeof Self>()({
  'PAYMENTS_TEXT.owesYouSince': [[M, D]],
  'PAYMENTS_TEXT.savedStillOwing': [[M]],
})

/** Every text a person reads in this area that is not a named message above, by key. */
export const PAYMENTS_TEXT = {
  owesYouSince: (balance: string | number, owing_since: string | number) => ` · owes you ${balance} since ${owing_since}`,
  all: 'All: ',
  method: 'Method',
  takenFromOldestDebt: 'Taken from the oldest debt',
  toTheSaleOf: ' to the sale of ',
  stillOwes: 'They still owe ',
  discardThePayment: 'Discard the payment?',
  amountOverBalance: 'The amount is more than they owe you.',
  dateInFuture: 'The date cannot be in the future.',
  enterValidAmount: 'Enter a valid amount.',
  chooseCashOrTransfer: 'Choose cash or transfer.',
  savedStillOwing: (balance: string): `Payment saved · still owing ${string}` => `Payment saved · still owing ${balance}`,
  saved: 'Payment saved',
} as const
