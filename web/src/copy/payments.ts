/** The payments words that are not a named message. */

import type { LimitedCopy } from './limits'

export const LANGUAGE: 'es' | 'en' = 'en'

export const LIMITED_COPY: readonly LimitedCopy[] = []
export const LONG_REFUSALS: readonly string[] = []

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
