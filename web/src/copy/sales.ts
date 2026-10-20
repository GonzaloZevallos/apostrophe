/** The `sales` section of the app's texts: the sale screens (New sale, Sales, a sale's page) and
 * their sheets. The fixed words that are always on screen (the empty list of Sales, the hint
 * under the disabled Owing and the line that has no price for its date) are registered in
 * `LIMITED_COPY` and measured with `SAMPLES` by `copy/copyLimits.test.ts`, never with fixture
 * or API data. `pricing.ts` builds its message from `noPriceMessage`. Words other sections own
 * are imported read-only (ADR-0025). */

import {
  CHOOSE_A_VARIETY,
  GENERIC_REFUSAL_MESSAGE,
  WORD_ADD_ANOTHER_VARIETY,
  WORD_CHANGE,
  WORD_GRAMS,
  WORD_MONTH,
  WORD_NOTE,
  WORD_PERIOD,
  WORD_VARIETY,
  WORD_WEEK,
} from './common.ts'
import { SAMPLES, type LimitedCopy } from './limits.ts'

export const EMPTY_LIST = "You haven't recorded any sales in this period yet."
export const GRAMS_HELP = 'Comma, up to two decimals'
export const OWING_HINT = 'To leave it owing, choose a customer'

/** The line of a variety with no price on the sale's date. */
export function noPriceMessage(varietyName: string): string {
  return `${varietyName} has no price for that date`
}

/** The Sales list: its periods, its date range and its rows. */
export const PERIOD = WORD_PERIOD
export const PERIOD_WEEK = WORD_WEEK
export const PERIOD_MONTH = WORD_MONTH
export const PERIOD_DATES = 'Dates'
export const FROM = 'From'
export const TO = 'To'
export const OWES = 'owes you'

/** The sale form: its fields, its totals and its actions. */
export const CHANGE = WORD_CHANGE
export const ADD_VARIETY = WORD_ADD_ANOTHER_VARIETY
export const SHIPPING = 'Shipping'
export const SHIPPING_CHARGED = 'Shipping charged'
export const NOTE = WORD_NOTE
export const TOTAL = 'Total'
export const SAVE_SALE = 'Save sale'
export const gramsSold = (grams: string) => `${grams} sold`
export const gramsGifted = (grams: string) => ` · ${grams} gifted`

/** The customer sheet of the sale form. */
export const CHOOSE_CUSTOMER = 'Choose customer'
export const SEARCH = 'Search'
export const NO_CUSTOMER = 'No customer'

/** One line of the sale: its summary, its fields and its remove button. */
export const NO_VARIETY = 'No variety'
export const VARIETY = WORD_VARIETY
export const CHOOSE_VARIETY = CHOOSE_A_VARIETY
export const GRAMS = WORD_GRAMS
export const GIFT = 'Gift'
export const SPECIAL_PRICE = 'Special price'
export const lineSummary = (n: number, name: string) => `Line ${n}: ${name}`
export const varietyOfLine = (n: number) => `Variety line ${n}`
export const gramsOfLine = (n: number) => `Grams line ${n}`
export const giftOfLine = (n: number) => `Gift line ${n}`
export const specialPriceOfLine = (n: number) => `Special price line ${n}`
export const removeLine = (n: number) => `Remove line ${n}`
export const pricePerGram = (price: string) => `${price} / g`

/** What the form refuses, in words that repeat nothing typed. */
export const NO_LINES_MESSAGE = 'Add at least one variety.'
export const PAYMENT_REQUIRED_MESSAGE = 'Choose how it was paid, or leave the sale owing'
export const SPECIAL_PRICE_INVALID_MESSAGE = 'The special price must be above $0'
export const LINE_GRAMS_INVALID = 'Enter the grams: comma, up to two decimals'
export const LINE_VARIETY_MISSING = CHOOSE_A_VARIETY
export const SHIPPING_NEGATIVE = 'Shipping cannot be negative'
export const NOTE_TOO_LONG = 'The note is too long'
export const DATE_IN_FUTURE = 'The date cannot be in the future'
export const GENERIC_REFUSAL = GENERIC_REFUSAL_MESSAGE

/** The leave confirmation of the sale form. */
export const DISCARD_SALE_QUESTION = 'Discard the sale?'
export const DISCARD_SALE_DETAIL = "You won't be able to get back what you entered."

/** A sale's page: its heading, its lines and its actions. */
export const saleOf = (date: string) => `Sale of ${date}`
export const UNDO = 'Undo'
export const LINES = 'Lines'
export const pricePerGramLine = (price: string) => `${price} per gram`
export const ASSIGN_CUSTOMER = 'Assign customer'
export const CUSTOMER_ASSIGNED = 'Customer assigned'
export const CUSTOMER_ALREADY_ASSIGNED_MESSAGE = 'This sale already has a customer.'
export const DELETE_SALE = 'Delete sale'
export const PAID_IN_CASH = 'paid in cash'
export const PAID_BY_TRANSFER = 'paid by transfer'
export const LEFT_OWING = 'left owing'
export const deleteSaleQuestion = (money: string, day: string, grams: string) =>
  `Delete the ${money} sale from ${day}? ${grams} go back to stock.`

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyLine', text: EMPTY_LIST },
  { kind: 'help', text: OWING_HINT },
  { kind: 'help', text: GRAMS_HELP },
  { kind: 'help', text: noPriceMessage(SAMPLES.name) },
]

/** Nothing here is over 80 characters. */
export const LONG_REFUSALS: readonly string[] = []
