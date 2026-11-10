/**
 * The fixed always-visible words of the Clientes screens (no JSX): their empty states, the
 * same bindings the screens render. Registered in `LIMITED_COPY` so
 * `copy/copyLimits.test.ts` measures them against the limit of the icon and text rule
 * (docs/product/icon-and-text-rule.md).
 */

import { baselineArgs, FIXTURE } from './baselineArgs.ts'
import type * as Self from './customers.ts'
import { SAMPLES, type LimitedCopy } from './limits.ts'
import { SHELL_TEXT } from './shell.ts'

export const LANGUAGE: 'es' | 'en' = 'en'

/** Heads everyone A–Z, under "Owed to you" (`Clientes.dc.html`). */
export const EVERYONE = 'Everyone · A–Z'

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
  notAPhone: 'Enter the number with its area code, or start with + and the country code.',
  phoneHintAR: '11 2345-6789',
  phoneHintUY: '099 123 456',
  phoneHintCL: '9 1234 5678',
  phoneHintPY: '0981 123 456',
  phoneHintBR: '(11) 91234-5678',
  phoneHintMX: '55 1234 5678',
  phoneHintES: '612 34 56 78',
  phoneHintUS: '(212) 555-0123',
  phoneHintNone: '+ and country code, then the number',
  needsCountryCode: 'Start the number with + and the country code.',
  phoneTaken: 'That phone number already belongs to another customer',
  searchCustomer: 'Search customer',
  searching: 'Searching…',
  methodCash: 'cash',
  methodTransfer: 'transfer',
  typeLabel: 'Customer type',
  typeNone: 'No type',
  typeNotice: 'Add a customer type',
  typeNotFound: 'That type no longer exists. Pick another one.',
  typeIconCircle: 'Circle',
  typeIconStar: 'Star',
  typeIconHeart: 'Heart',
  typeIconDiamond: 'Diamond',
  typeIconFlag: 'Flag',
  typeIconTag: 'Tag',
  typeIconCrown: 'Crown',
  typeIconBell: 'Bell',
  balanceAmount: (running_balance: string | number) => `balance ${running_balance}`,
} as const

/** The phone field's placeholder: a local example of the business's Phone country, or the "+" form
 * when it has none (or a country this build has no example for). */
export function phoneHint(country: string | null): string {
  switch (country) {
    case 'AR':
      return CUSTOMERS_TEXT.phoneHintAR
    case 'UY':
      return CUSTOMERS_TEXT.phoneHintUY
    case 'CL':
      return CUSTOMERS_TEXT.phoneHintCL
    case 'PY':
      return CUSTOMERS_TEXT.phoneHintPY
    case 'BR':
      return CUSTOMERS_TEXT.phoneHintBR
    case 'MX':
      return CUSTOMERS_TEXT.phoneHintMX
    case 'ES':
      return CUSTOMERS_TEXT.phoneHintES
    case 'US':
      return CUSTOMERS_TEXT.phoneHintUS
    default:
      return CUSTOMERS_TEXT.phoneHintNone
  }
}

/** The ledger's fixed words, registered with the filled placeholder the screen shows
 * (`SAMPLES`' worst cases), so `copy/copyLimits.test.ts` measures them. */
export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'help', text: CUSTOMERS_TEXT.saleTitle },
  { kind: 'help', text: CUSTOMERS_TEXT.nothingToPay },
  { kind: 'help', text: CUSTOMERS_TEXT.accountHeading },
  { kind: 'help', text: CUSTOMERS_TEXT.paymentTitle(CUSTOMERS_TEXT.methodTransfer) },
  { kind: 'help', text: CUSTOMERS_TEXT.onAccountOf(SAMPLES.date) },
]


const { money: M, date: D } = FIXTURE

/** The fixture arguments of this file's functions, for `en.baseline.json` (`./baselineArgs.ts`). */
export const BASELINE_ARGS = baselineArgs<typeof Self>()({
  phoneHint: [['AR'], ['UY'], [null]],
  'CUSTOMERS_TEXT.deletePaymentOf': [[M, 'cash', D]],
  'CUSTOMERS_TEXT.paymentTitle': [['cash']],
  'CUSTOMERS_TEXT.onAccountOf': [[D]],
  'CUSTOMERS_TEXT.creditAmount': [[M]],
  'CUSTOMERS_TEXT.balanceAmount': [[M]],
})
