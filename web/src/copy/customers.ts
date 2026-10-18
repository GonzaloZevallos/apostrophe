/**
 * The fixed always-visible words of the Clientes screens (no JSX): their empty states, the
 * same bindings the screens render. Registered in `LIMITED_COPY` so
 * `copy/copyLimits.test.ts` measures them against the limit of the icon and text rule
 * (docs/product/icon-and-text-rule.md).
 */

import { NOBODY_OWES } from './common'
import { salesCount } from './format'
import type { LimitedCopy } from './limits'

/** Clientes' empty list. */
export const EMPTY_CUSTOMERS = "You haven't added any customers yet."
/** Heads everyone A–Z, under the Owed section (`Clientes.dc.html`). */
export const EVERYONE = 'Everyone · A–Z'

/** The Customers list: its search, its count line and its one action. */
export const SEARCH_LABEL = 'Search customer'
export const SEARCH_PLACEHOLDER = 'Phone or name'
export const SEARCHING = 'Searching…'
export const customerCount = (count: number) => `${count} ${count === 1 ? 'customer' : 'customers'}`
export const NEW_CUSTOMER = 'New customer'

/** The Owed section: its heading and the count of sales still owing. */
export const OWED = 'Owed'
export const salesOwing = (count: number) => `${salesCount(count)} owing`

/** A customer's row: what it says about money and its Collect button. */
export const owesSince = (date: string) => `owes you since ${date}`
export const creditOf = (amount: string) => `Credit ${amount}`
export const COLLECT = 'Collect'
export const collectFrom = (name: string) => `Collect from ${name}`

/** The customer fields shared by the form and the sale's sheet. */
export const PHONE = 'Phone'
export const NAME = 'Name'

/** The Record payment screen: its title and its leave confirmation. */
export const RECORD_PAYMENT = 'Record payment'
export const DISCARD_PAYMENT_QUESTION = 'Discard the payment?'
export const LEAVE_DETAIL = "What you entered is lost: nothing has been saved yet."
export const KEEP_EDITING = 'No, keep going'
export const DISCARD = 'Yes, discard it'

/** The customer form: its title, its refusals and its save. */
export const EDIT_CUSTOMER = 'Edit customer'
export const SAVE_AND_USE = 'Save and use'
export const CREATE_CUSTOMER = 'Create customer'
export const NAME_REQUIRED = 'Give them a name'
export const NAME_TOO_LONG = 'The name is too long'
export const PHONE_INVALID = "That doesn't look like a phone number with its area code"
export const PHONE_TAKEN = 'That phone belongs to another customer'
export const DISCARD_CUSTOMER_QUESTION = 'Discard the customer?'

/** A customer's card: its balance, its account rows and its actions. */
export const owes = (money: string) => `Owes you ${money}`
export const balanceOf = (money: string) => `balance ${money}`
export const CREDIT = 'Credit'
export const YES = 'Yes'
export const NO = 'No'
export const EDIT = 'Edit'
export const PAYMENT_DELETED = 'Payment deleted'
export const DELETE_PAYMENT = 'Delete payment'
export const newSaleTo = (name: string) => `New sale for ${name}`
export const DELETE_DETAIL = 'This cannot be undone.'
export const CONFIRM_DELETE = 'Yes, delete it'
export const CANCEL_DELETE = 'No, keep it'
export const HOW_PAID_CASH = 'Paid in cash'
export const HOW_PAID_TRANSFER = 'Paid by transfer'
export const HOW_PAID_OWING = 'Left owing'
export const METHOD_CASH = 'cash'
export const METHOD_TRANSFER = 'transfer'
export const deletePaymentQuestion = (money: string, method: string, day: string) =>
  `Delete the ${money} payment (${method}) from ${day}?`
export const paymentRow = (method: string, day: string) => `Payment · ${method} · Applied to the sale of ${day}`

/** The Record payment screen: its fields, its refusals and its toast. */
export const AMOUNT = 'Amount'
export const DATE = 'Date'
export const METHOD = 'Method'
export const OLDEST_DEBT_FIRST = 'Comes off the oldest debt first'
export const ABOVE_BALANCE = 'The amount is more than they owe you.'
export const FUTURE_DATE = 'The date cannot be in the future.'
export const AMOUNT_INVALID = 'Enter a valid amount.'
export const METHOD_REQUIRED = 'Choose cash or transfer.'
export const PAYMENT_SAVED = 'Payment saved'
export const paymentSavedOwing = (money: string) => `Payment saved · still owes ${money}`
export const owesSinceLine = (money: string, day: string) => ` · owes you ${money} since ${day}`
export const allOf = (money: string) => `All: ${money}`
export const splitToSale = (money: string, day: string) => `${money} to the sale of ${day}`
export const stillOwes = (money: string) => `Still owes ${money}`

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyTitle', text: EMPTY_CUSTOMERS },
  { kind: 'emptyTitle', text: NOBODY_OWES },
]
export const LONG_REFUSALS: readonly string[] = []
