/** The fixed English of the sale screens that is always on screen: the empty list of
 * Ventas, the hint under the disabled Debiendo and the line that has no price for its
 * date. Each binding is the one its screen renders (`pricing.ts` builds the message
 * from `noPriceMessage`), registered here and measured with `SAMPLES` by
 * `copy/copyLimits.test.ts`, never with fixture or API data. */

import { baselineArgs, counted, FIXTURE } from './baselineArgs.ts'
import type * as Self from './sales.ts'
import { SAMPLES, type LimitedCopy } from './limits.ts'
import { COMMON_TEXT } from './common.ts'
import { CUSTOMERS_TEXT } from './customers.ts'
import { ONBOARDING_TEXT } from './onboarding.ts'
import { STOCK_TEXT } from './stock.ts'
import { VARIETIES_TEXT } from './varieties.ts'

export const LANGUAGE: 'es' | 'en' = 'en'

export const GRAMS_HELP = 'Comma, up to two decimals'
export const OWING_HINT = 'To leave it owing, pick a customer'
/** Shown under New sale in the computer rail and the phone bar while nothing is priced, and
 * as the open line's hint on New sale when no Product has a Current price on the date. */
export const NO_PRICE_HINT = 'Add a price to a product so you can sell'

/** The line of a variety with no price on the sale's date. */
export function noPriceMessage(varietyName: string): string {
  return `${varietyName} has no price for that date`
}

/** The sale bill: the Share/Copy button, its outcomes and the fixed words of the text a
 * seller sends the customer. The separator is " · ". The bill adds no formatting of its
 * own, so no entry holds `*`, `_` or a backtick; names and figures are the sale's. `unit`
 * is the one unit entry until #318. */
export const SALE_BILL_TEXT = {
  share: COMMON_TEXT.share,
  copy: COMMON_TEXT.copy,
  copied: 'Bill copied',
  shareFailed: "Couldn't share. Tap Copy and paste it into the chat.",
  copyFailed: "Couldn't copy. Select the text below and copy it by hand.",
  blockName: 'Sale bill',
  header: (business: string, saleNumber: string, date: string) => `${business}\n${saleNumber} · ${date}`,
  item: (product: string, quantity: string, unit: string, amount: string) =>
    `${product} ${quantity} ${unit} · ${amount}`,
  bulk: (product: string, quantity: string, unit: string, unitPrice: string, amount: string) =>
    `${product} ${quantity} ${unit} · bulk price ${unitPrice}/${unit} · ${amount}`,
  gift: (product: string, quantity: string, unit: string) => `${product} ${quantity} ${unit} · Gift · $ 0`,
  shipping: (amount: string) => `Shipping · ${amount}`,
  total: (amount: string) => `Total · ${amount}`,
  paid: CUSTOMERS_TEXT.paid,
  stillOwed: (amount: string) => `Still owed on this sale: ${amount}`,
  balance: (amount: string) => `Your balance: ${amount}`,
  credit: (amount: string) => `In your favor: ${amount}`,
  unit: 'g',
}

/** New sale's Product list. `stock` is already formatted; the step names carry the Product's own name. */
const NEW_SALE_TEXT = {
  productsInSale: (n: number) => `In the sale · ${n}`,
  productsMostSold: 'Most sold',
  productStock: (stock: string) => `${stock} in stock`,
  productNoPrice: 'No price',
  productAdd: (name: string) => `Add ${name}`,
  productIncrease: (name: string) => `Add one ${name}`,
  productDecrease: (name: string) => `Remove one ${name}`,
}

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'help', text: OWING_HINT },
  { kind: 'help', text: NO_PRICE_HINT },
  { kind: 'help', text: GRAMS_HELP },
  { kind: 'help', text: noPriceMessage(SAMPLES.name) },
  { kind: 'notice', text: SALE_BILL_TEXT.shareFailed },
  { kind: 'notice', text: SALE_BILL_TEXT.copyFailed },
  { kind: 'help', text: NEW_SALE_TEXT.productsInSale(Number(SAMPLES.count)) },
  { kind: 'help', text: NEW_SALE_TEXT.productsMostSold },
  { kind: 'help', text: NEW_SALE_TEXT.productStock(SAMPLES.grams) },
  { kind: 'help', text: NEW_SALE_TEXT.productNoPrice },
  { kind: 'help', text: NEW_SALE_TEXT.productAdd(SAMPLES.name) },
  { kind: 'help', text: NEW_SALE_TEXT.productIncrease(SAMPLES.name) },
  { kind: 'help', text: NEW_SALE_TEXT.productDecrease(SAMPLES.name) },
]

/** Nothing here is over 80 characters. */
export const LONG_REFUSALS: readonly string[] = []


const { money: M, attachedZero: AZ, date: D, grams: G } = FIXTURE

/** The fixture arguments of this file's functions, for `en.baseline.json` (`./baselineArgs.ts`). */
export const BASELINE_ARGS = baselineArgs<typeof Self>()({
  noPriceMessage: [['Rosa']],
  'SALES_TEXT.giftGrams': [[G]],
  'SALES_TEXT.lineLabel': [['2', 'Rosa']],
  'SALES_TEXT.withUnit': [['3,5']],
  'SALES_TEXT.specialPriceAboveZero': [[AZ]],
  'SALES_TEXT.lineVariety': [['2']],
  'SALES_TEXT.lineGrams': [['2']],
  'SALES_TEXT.lineGift': [['2']],
  'SALES_TEXT.lineSpecialPrice': [['2']],
  'SALES_TEXT.removeLine': [['2']],
  'SALES_TEXT.products': counted((n) => [n]),
  'SALES_TEXT.collectTitle': counted((n) => [n]),
  'SALES_TEXT.collect': [[M]],
  'SALES_TEXT.saleInProgressName': [
    ['2 products', M],
    ['1 product', null],
  ],
  'SALES_TEXT.saleNumber': [[1284]],
  'SALES_TEXT.deleteSaleConfirm': [[M, D, G]],
  'SALES_TEXT.newSale.productsInSale': [[2]],
  'SALES_TEXT.newSale.productStock': [['1,5']],
  'SALES_TEXT.newSale.productAdd': [['Rosa']],
  'SALES_TEXT.newSale.productIncrease': [['Rosa']],
  'SALES_TEXT.newSale.productDecrease': [['Rosa']],
  'SALE_BILL_TEXT.header': [['Flores Test', 'Sale #1284', D]],
  'SALE_BILL_TEXT.item': [['Rosa', '3,5', 'g', M]],
  'SALE_BILL_TEXT.bulk': [['Rosa', '10', 'g', M, M]],
  'SALE_BILL_TEXT.gift': [['Rosa', '1', 'g']],
  'SALE_BILL_TEXT.shipping': [[M]],
  'SALE_BILL_TEXT.total': [[M]],
  'SALE_BILL_TEXT.stillOwed': [[M]],
  'SALE_BILL_TEXT.balance': [[M]],
  'SALE_BILL_TEXT.credit': [[M]],
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
  lineVariety: (n: string | number) => `Line ${n} product`,
  lineGrams: (n: string | number) => `Line ${n} grams`,
  lineGift: (n: string | number) => `Line ${n} gift`,
  gift: 'Gift',
  lineSpecialPrice: (n: string | number) => `Line ${n} special price`,
  specialPrice: 'Special price',
  removeLine: (n: string | number) => `Remove line ${n}`,
  saleNumber: (n: number) => `Sale #${n}`,
  undo: 'Undo',
  lines: 'Lines',
  perGram: VARIETIES_TEXT.elGramo,
  customerAssigned: 'Customer assigned',
  assignCustomer: 'Assign customer',
  deleteSale: 'Delete sale',
  from: 'From',
  to: 'To',
  owesYou: 'owes you',
  addAtLeastOne: 'Add at least one product.',
  pickHowPaid: 'Pick how it was paid, or leave the sale owing',
  /** `zero` is the business's zero amount written attached to its symbol (`useMoney().attached(0)`). */
  specialPriceAboveZero: (zero: string) => `The special price must be more than ${zero}`,
  enterGrams: 'Enter the grams: comma, up to two decimals',
  shippingNotNegative: 'Shipping cannot be negative',
  noteTooLong: 'The note is too long',
  noVariety: 'No product',
  saleHasCustomer: 'This sale already has a customer.',
  leftOwing: 'left owing',
  paid: 'paid',
  deleteSaleConfirm: (money: string | number, day: string | number, grams: string | number) =>
    `Delete the sale of ${money} from ${day}? ${grams} go back to stock.`,
  dates: 'Dates',
  otherThingsToRecord: 'Other things to record',
  expense: 'Expense',
  saleInProgress: 'Sale in progress',
  products: (n: number) => [n, n === 1 ? STOCK_TEXT.varietyOne : STOCK_TEXT.varietyMany].join(' '),
  back: ONBOARDING_TEXT.back,
  expenseRecorded: 'Expense recorded',
  /** The strip's accessible name; the first argument is the count line from `SALES_TEXT.products(n)`; `amount` is the Total row's
   * figure, or `null` while the prices are being recalculated (the amount clause is dropped). */
  saleInProgressName: (products: string, amount: string | null) =>
    amount === null ? `Sale in progress, ${products}. Back` : `Sale in progress, ${products}, ${amount}. Back`,
  /** The closing Sheet's title: the sale's line count. */
  collectTitle: (n: number) => (n === 1 ? 'The sale · 1 item' : `The sale · ${n} items`),
  howTheyPay: 'How they pay',
  chooseMethod: 'Choose a method',
  noMethodToCollect: 'Choose how they pay to collect.',
  /** `total` is the sale's total in the business's Money format (`useMoney().money`). */
  collect: (total: string) => `Collect ${total}`,
  saving: 'Saving…',
  newSale: NEW_SALE_TEXT,
} as const
