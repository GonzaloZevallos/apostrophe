/** The fixed English of the sale screens that is always on screen: the empty list of
 * Ventas, the hint under the disabled Debiendo and the line that has no price for its
 * date. Each binding is the one its screen renders (`pricing.ts` builds the message
 * from `noPriceMessage`), registered here and measured with `SAMPLES` by
 * `copy/copyLimits.test.ts`, never with fixture or API data. */

import { baselineArgs } from './baselineArgs.ts'
import type * as Self from './sales.ts'
import { SAMPLES, type LimitedCopy } from './limits.ts'
import { EMPTY_STATES } from './emptyStates.ts'
import { VARIETIES_TEXT } from './varieties.ts'

export const LANGUAGE: 'es' | 'en' = 'en'

export const EMPTY_LIST = EMPTY_STATES.salesList
export const GRAMS_HELP = 'Comma, up to two decimals'
export const OWING_HINT = 'To leave it owing, pick a customer'

/** The line of a variety with no price on the sale's date. */
export function noPriceMessage(varietyName: string): string {
  return `${varietyName} has no price for that date`
}

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyLine', text: EMPTY_LIST },
  { kind: 'help', text: OWING_HINT },
  { kind: 'help', text: GRAMS_HELP },
  { kind: 'help', text: noPriceMessage(SAMPLES.name) },
]

/** Nothing here is over 80 characters. */
export const LONG_REFUSALS: readonly string[] = []

const M = '$ 11.000'
const D = '28/09'
const G = '3,5 g'

/** The fixture arguments of this file's functions, for `en.baseline.json` (`./baselineArgs.ts`). */
export const BASELINE_ARGS = baselineArgs<typeof Self>()({
  noPriceMessage: [['Rosa']],
  'SALES_TEXT.giftGrams': [[G]],
  'SALES_TEXT.lineLabel': [['2', 'Rosa']],
  'SALES_TEXT.withUnit': [['3,5']],
  'SALES_TEXT.lineVariety': [['2']],
  'SALES_TEXT.lineGrams': [['2']],
  'SALES_TEXT.lineGift': [['2']],
  'SALES_TEXT.lineSpecialPrice': [['2']],
  'SALES_TEXT.removeLine': [['2']],
  'SALES_TEXT.saleOf': [[D]],
  'SALES_TEXT.deleteSaleConfirm': [[M, D, G]],
})

/** Every text a person reads in this area that is not a named message above, by key. */
export const SALES_TEXT = {
  ruleList: 'list',
  ruleBulk: 'bulk',
  ruleGift: 'gift',
  ruleSpecial: 'special',
  pickCustomer: 'Pick a customer',
  shippingCharged: 'Shipping charged',
  shipping: 'Shipping',
  total: 'Sale total',
  giftGrams: (grams: string | number) => ` · ${grams} gift`,
  saveSale: 'Save sale',
  discardSale: 'Discard the sale?',
  cannotRecover: "You won't be able to get back what you entered.",
  search: 'Search',
  noCustomer: 'No customer',
  createCustomer: 'Create customer',
  lineLabel: (n: string | number, displayName: string | number) => `Line ${n}: ${displayName}`,
  withUnit: (grams: string | number) => `${grams} g`,
  lineVariety: (n: string | number) => `Line ${n} variety`,
  lineGrams: (n: string | number) => `Line ${n} grams`,
  lineGift: (n: string | number) => `Line ${n} gift`,
  gift: 'Gift',
  lineSpecialPrice: (n: string | number) => `Line ${n} special price`,
  specialPrice: 'Special price',
  removeLine: (n: string | number) => `Remove line ${n}`,
  saleOf: (date: string | number) => `Sale of ${date}`,
  undo: 'Undo',
  lines: 'Lines',
  perGram: VARIETIES_TEXT.elGramo,
  customerAssigned: 'Customer assigned',
  assignCustomer: 'Assign customer',
  deleteSale: 'Delete sale',
  from: 'From',
  to: 'To',
  owesYou: 'owes you',
  addAtLeastOne: 'Add at least one variety.',
  pickHowPaid: 'Pick how it was paid, or leave the sale owing',
  specialPriceAboveZero: 'The special price must be more than $0',
  enterGrams: 'Enter the grams: comma, up to two decimals',
  shippingNotNegative: 'Shipping cannot be negative',
  noteTooLong: 'The note is too long',
  noVariety: 'No variety',
  saleHasCustomer: 'This sale already has a customer.',
  leftOwing: 'left owing',
  paidInCash: 'paid in cash',
  paidByTransfer: 'paid by transfer',
  deleteSaleConfirm: (money: string | number, day: string | number, grams: string | number) =>
    `Delete the sale of ${money} from ${day}? ${grams} go back to stock.`,
  dates: 'Dates',
} as const
