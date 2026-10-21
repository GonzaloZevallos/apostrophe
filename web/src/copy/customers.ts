/**
 * The fixed always-visible words of the Clientes screens (no JSX): their empty states, the
 * same bindings the screens render. Registered in `LIMITED_COPY` so
 * `copy/copyLimits.test.ts` measures them against the limit of the icon and text rule
 * (docs/product/icon-and-text-rule.md).
 */

import type { LimitedCopy } from './limits'
import { EMPTY_STATES } from './emptyStates'

export const LANGUAGE: 'es' | 'en' = 'en'

/** Clientes' empty list. */
export const EMPTY_CUSTOMERS = EMPTY_STATES.customersList
/** Heads everyone A–Z, under "Owed to you" (`Clientes.dc.html`). */
export const EVERYONE = 'Everyone · A–Z'
/** "Owed to you" with nobody owing. */
export const NOBODY_OWES = EMPTY_STATES.homeNobodyOwes

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyTitle', text: EMPTY_CUSTOMERS },
  { kind: 'emptyTitle', text: NOBODY_OWES },
]
export const LONG_REFUSALS: readonly string[] = []

/** Every text a person reads in this area that is not a named message above, by key. */
export const CUSTOMERS_TEXT = {
  paymentDeleted: 'Payment deleted',
  owesYou: 'Owes you ',
  since: 'since ',
  credit: 'Credit ',
  creditLabel: 'Credit',
  phone: 'Phone',
  yes: 'Yes',
  off: 'No',
  deletePayment: 'Delete payment',
  newSaleTo: 'New sale to ',
  owesYouSince: 'owes you since ',
  saveAndUse: 'Save and use',
  discardTheCustomer: 'Discard the customer?',
  oneCustomer: '1 customer',
  customerCount: (count: string | number) => `${count} customers`,
  paidInCash: 'Paid in cash',
  paidByTransfer: 'Paid by transfer',
  leftOwing: 'Left owing',
  deletePaymentOf: (amount: string | number, method: string | number, paid_on: string | number) => `Delete the payment of ${amount} (${method}) from ${paid_on}?`,
  paymentOnAccount: (method: string | number, sale_date: string | number) => `Payment · ${method} · On account of the sale of ${sale_date}`,
  creditAmount: (running_balance: string | number) => `Credit ${running_balance}`,
  giveItAName: 'Give them a name',
  notAPhone: 'That does not look like a phone number with its area code',
  phoneTaken: 'That phone number already belongs to another customer',
  searchCustomer: 'Search customer',
  searching: 'Searching…',
} as const
