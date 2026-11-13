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
  paid: 'Paid',
  paidWith: (method: string | number) => `Paid · ${method}`,
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
  phoneHintNone: '+ and country code, then the number',
  phoneCountryLabel: 'Phone country',
  phoneCountryOther: 'Other (type + and the code)',
  phoneCountryLockedReason: 'The + and the code set the country',
  phoneCountryAR: 'Argentina',
  phoneCountryUY: 'Uruguay',
  phoneCountryCL: 'Chile',
  phoneCountryPY: 'Paraguay',
  phoneCountryBR: 'Brazil',
  phoneCountryMX: 'Mexico',
  phoneCountryES: 'Spain',
  phoneCountryUS: 'United States',
  /** One option of the Phone country Selector: the country's name and its calling code, which the
   * API sends (the front never holds a code of its own). */
  phoneCountryOption: (name: string | number, calling_code: string | number) => `${name} (+${calling_code})`,
  /** The adjective carries its article, so a language can place it as it needs. */
  phoneAdjectiveAR: 'an Argentine',
  phoneAdjectiveUY: 'a Uruguayan',
  phoneAdjectiveCL: 'a Chilean',
  phoneAdjectivePY: 'a Paraguayan',
  phoneAdjectiveBR: 'a Brazilian',
  phoneAdjectiveMX: 'a Mexican',
  phoneAdjectiveES: 'a Spanish',
  phoneAdjectiveUS: 'a US',
  phoneLengthsOr: 'or',
  phoneInvalidFor: (adjective: string | number, lengths: string | number) => `That doesn't look like ${adjective} number. It needs ${lengths} digits after the country code.`,
  needsCountryCode: 'Start the number with + and the country code.',
  phoneTaken: 'That phone number already belongs to another customer',
  searchCustomer: 'Search customer',
  searching: 'Searching…',
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

/** Each listed Phone country's name and adjective, keyed by its ISO code. A code with no entry
 * shows the code itself. The lengths, the calling codes and the examples are never here: they
 * come from `GET /phone-countries`. */
const PHONE_COUNTRY_NAMES: ReadonlyMap<string, string> = new Map([
  ['AR', CUSTOMERS_TEXT.phoneCountryAR],
  ['UY', CUSTOMERS_TEXT.phoneCountryUY],
  ['CL', CUSTOMERS_TEXT.phoneCountryCL],
  ['PY', CUSTOMERS_TEXT.phoneCountryPY],
  ['BR', CUSTOMERS_TEXT.phoneCountryBR],
  ['MX', CUSTOMERS_TEXT.phoneCountryMX],
  ['ES', CUSTOMERS_TEXT.phoneCountryES],
  ['US', CUSTOMERS_TEXT.phoneCountryUS],
])

const PHONE_ADJECTIVES: ReadonlyMap<string, string> = new Map([
  ['AR', CUSTOMERS_TEXT.phoneAdjectiveAR],
  ['UY', CUSTOMERS_TEXT.phoneAdjectiveUY],
  ['CL', CUSTOMERS_TEXT.phoneAdjectiveCL],
  ['PY', CUSTOMERS_TEXT.phoneAdjectivePY],
  ['BR', CUSTOMERS_TEXT.phoneAdjectiveBR],
  ['MX', CUSTOMERS_TEXT.phoneAdjectiveMX],
  ['ES', CUSTOMERS_TEXT.phoneAdjectiveES],
  ['US', CUSTOMERS_TEXT.phoneAdjectiveUS],
])

export function phoneCountryName(code: string): string {
  return PHONE_COUNTRY_NAMES.get(code) ?? code
}

/** The adjective (with its article) of a listed country; a code with none shows the code itself. */
export function phoneAdjective(code: string): string {
  return PHONE_ADJECTIVES.get(code) ?? code
}

/** The served national lengths as words: `9`, `8 or 9`, `8, 9 or 10`. */
export function phoneLengthsText(lengths: readonly number[]): string {
  const sorted = [...lengths].sort((a, b) => a - b).map(String)
  const last = sorted.pop()
  if (last === undefined) return ''
  return sorted.length === 0 ? last : `${sorted.join(', ')} ${CUSTOMERS_TEXT.phoneLengthsOr} ${last}`
}

/** The ledger's fixed words, registered with the filled placeholder the screen shows
 * (`SAMPLES`' worst cases), so `copy/copyLimits.test.ts` measures them. */
export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'help', text: CUSTOMERS_TEXT.saleTitle },
  { kind: 'help', text: CUSTOMERS_TEXT.nothingToPay },
  { kind: 'help', text: CUSTOMERS_TEXT.accountHeading },
  { kind: 'help', text: CUSTOMERS_TEXT.paymentTitle(SAMPLES.name) },
  { kind: 'help', text: CUSTOMERS_TEXT.paidWith(SAMPLES.name) },
  { kind: 'help', text: CUSTOMERS_TEXT.onAccountOf(SAMPLES.date) },
]


const { money: M, date: D } = FIXTURE

/** The fixture arguments of this file's functions, for `en.baseline.json` (`./baselineArgs.ts`). */
export const BASELINE_ARGS = baselineArgs<typeof Self>()({
  'CUSTOMERS_TEXT.deletePaymentOf': [[M, 'cash', D]],
  'CUSTOMERS_TEXT.paymentTitle': [['cash']],
  'CUSTOMERS_TEXT.paidWith': [['cash']],
  'CUSTOMERS_TEXT.onAccountOf': [[D]],
  'CUSTOMERS_TEXT.creditAmount': [[M]],
  'CUSTOMERS_TEXT.balanceAmount': [[M]],
  'CUSTOMERS_TEXT.phoneCountryOption': [['Uruguay', '598']],
  'CUSTOMERS_TEXT.phoneInvalidFor': [['an Argentine', '10']],
  phoneCountryName: [['AR'], ['xx']],
  phoneAdjective: [['AR'], ['xx']],
  phoneLengthsText: [[[9]], [[8, 9]], [[8, 9, 10]], [[]]],
})
