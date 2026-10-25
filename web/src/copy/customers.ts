/**
 * The fixed always-visible words of the Clientes screens (no JSX): their empty states, the
 * same bindings the screens render. Registered in `LIMITED_COPY` so
 * `copy/copyLimits.test.ts` measures them against the limit of the icon and text rule
 * (docs/product/icon-and-text-rule.md).
 */

import { baselineArgs } from './baselineArgs.ts'
import type * as Self from './customers.ts'
import { SAMPLES, type LimitedCopy } from './limits.ts'
import { SHELL_TEXT } from './shell.ts'

export const LANGUAGE: 'es' | 'en' = 'en'

/** Clientes' empty list. */
export const EMPTY_CUSTOMERS = 'You have not added any customers yet.'
/** Heads everyone A–Z, under "Owed to you" (`Clientes.dc.html`). */
export const EVERYONE = 'Everyone · A–Z'
/** "Owed to you" with nobody owing. */
export const NOBODY_OWES = 'Nobody owes you'

export const LONG_REFUSALS: readonly string[] = []

/** Every text a person reads in this area that is not a named message above, by key. */
export const CUSTOMERS_TEXT = {
  paymentDeleted: 'Payment deleted',
  owesYou: 'Owes you',
  since: 'since ',
  credit: 'Credit ',
  creditLabel: 'Credit',
  phone: 'Phone',
  phoneOptional: '(optional)',
  yes: 'Yes',
  off: 'No',
  deletePayment: 'Delete payment',
  newSaleTo: 'New sale to ',
  owesYouSince: 'owes you since ',
  saveAndUse: 'Save and use',
  discardTheCustomer: 'Discard the customer?',
  paidInCash: 'Paid in cash',
  paidByTransfer: 'Paid by transfer',
  leftOwing: 'Left owing',
  deletePaymentOf: (amount: string | number, method: string | number, paid_on: string | number) => `Delete the payment of ${amount} (${method}) from ${paid_on}?`,
  saleTitle: SHELL_TEXT.sale,
  nothingToPay: 'Nothing to pay',
  accountHeading: 'Account · running balance',
  paymentTitle: (method: string | number) => `Payment · ${method}`,
  onAccountOf: (sale_date: string | number) => `On account of the sale of ${sale_date}`,
  creditAmount: (running_balance: string | number) => `Credit ${running_balance}`,
  giveItAName: 'Give them a name',
  notAPhone: 'That does not look like a phone number with its area code',
  phoneTaken: 'That phone number already belongs to another customer',
  searchCustomer: 'Search customer',
  searching: 'Searching…',
  methodCash: 'cash',
  methodTransfer: 'transfer',
  balanceAmount: (running_balance: string | number) => `balance ${running_balance}`,
} as const

/** The ledger's fixed words, registered with the filled placeholder the screen shows
 * (`SAMPLES`' worst cases), so `copy/copyLimits.test.ts` measures them. */
export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyTitle', text: EMPTY_CUSTOMERS },
  { kind: 'emptyTitle', text: NOBODY_OWES },
  { kind: 'help', text: CUSTOMERS_TEXT.saleTitle },
  { kind: 'help', text: CUSTOMERS_TEXT.nothingToPay },
  { kind: 'help', text: CUSTOMERS_TEXT.accountHeading },
  { kind: 'help', text: CUSTOMERS_TEXT.paymentTitle(CUSTOMERS_TEXT.methodTransfer) },
  { kind: 'help', text: CUSTOMERS_TEXT.onAccountOf(SAMPLES.date) },
]

const M = '$ 11.000'
const D = '28/09'

/** The fixture arguments of this file's functions, for `en.baseline.json` (`./baselineArgs.ts`). */
export const BASELINE_ARGS = baselineArgs<typeof Self>()({
  'CUSTOMERS_TEXT.deletePaymentOf': [[M, 'cash', D]],
  'CUSTOMERS_TEXT.paymentTitle': [['cash']],
  'CUSTOMERS_TEXT.onAccountOf': [[D]],
  'CUSTOMERS_TEXT.creditAmount': [[M]],
  'CUSTOMERS_TEXT.balanceAmount': [[M]],
})
