/**
 * The words two or more sections say, defined once here and imported by the sections that
 * use them (ADR-0025: a screen never imports a message from another screen). A section
 * never copies a value this file owns.
 */

import type { LimitedCopy } from './limits.ts'

/** The label of an icon-only close control and of a sheet's way out. */
export const CLOSE = 'Close'

/** The label of the button that saves a form that edits. */
export const SAVE = 'Save'

/** "Owed" with nobody owing: the Customers list and Home's panel. */
export const NOBODY_OWES = 'Nobody owes you'

/** The refusal of a form whose fields the API refused without a field of its own. */
export const GENERIC_REFUSAL_MESSAGE = 'Check the details and try again.'

/** One sentence that promises no automatic retry: the app performs none. */
export const NO_CONNECTION_MESSAGE = 'No connection: check your internet and try again.'

/** The generic server-error retry. */
export const RETRY_MESSAGE = 'Something went wrong. Try again.'

/** Shown after a save or a delete lands on a record that is gone: no id, name, date or
 * amount, so it reads the same whatever was deleted, foreign, or never existed (ADR-0004). */
export const GONE_NOTICE = "That's gone. The list is up to date."

/** Shown instead of a detail screen for a record that is gone, with no data of its own. */
export const GONE_DETAIL = "That's gone."

/** The accessible name of the progress indicator `Estados` draws. */
export const LOADING = 'Loading'

/** The accessible name of the "i" that opens a shortened line's longer explanation. */
export const MORE_INFO = 'More info'

/** The password field's reveal toggle. */
export const SHOW = 'Show'
export const HIDE = 'Hide'

/** The three ways a sale is paid, as the payment selector words them. */
export const PAID_CASH = 'Cash'
export const PAID_TRANSFER = 'Transfer'
export const PAID_OWING = 'Owing'
export const HOW_PAID = 'How it was paid'

/** The pricing rule's pill: the one word of each rule. */
export const RULE_LIST = 'list'
export const RULE_BULK = 'bulk'
export const RULE_VIP = 'VIP'
export const RULE_GIFT = 'gift'
export const RULE_SPECIAL = 'special'

/** The stock status words: the mark, the side note and the list's summary line. */
export const STATUS_NO_ENTRIES = 'no entries'
export const STATUS_SOLD_OUT = 'sold out'
export const STATUS_LOW = 'low'
export const STATUS_OK = 'ok'

/** The way back from a gone record's screen to its list. */
export const backTo = (label: string) => `Back to ${label}`

/** The plain success toasts a screen shows by navigating away, and the saved sale's notice. */
export const CUSTOMER_SAVED = 'Customer saved'
export const SALE_DELETED = 'Sale deleted'
export const SALE_DELETED_STOCK_BACK = 'Sale deleted · the grams go back to stock'
export const ENTRY_SAVED = 'Entry saved'
export const ENTRY_DELETED = 'Entry deleted'
export const SALE_SAVED = 'Sale saved'

/** What the stock lines say (`stock/detail.ts` and `stock/summaryLine.ts`). */
export const FIRST_ENTRY_HINT = 'Add the first entry'
export const NO_GRAMS = 'No grams'
export const noGramsSince = (date: string) => `No grams since ${date}`
export const WARNS_BELOW_THRESHOLD = 'Warns you below the threshold'
export const warnsBelow = (grams: string) => `Warns you below ${grams}`
export const AT_THE_PACE = 'At the pace of the last 30 days'
export const daysLeft = (days: number) => `${days} days`
export const WARNING_OFF = 'Warning off'
export const warningLow = (grams: string) => `Warning: ${grams} left`
export const warnMeBelow = (grams: string) => `Warn me below ${grams}`
export const varietiesAllOk = (count: number) => `${count} ${count === 1 ? 'variety' : 'varieties'} · all ok`

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'emptyTitle', text: NOBODY_OWES },
  { kind: 'notice', text: NO_CONNECTION_MESSAGE },
  { kind: 'notice', text: RETRY_MESSAGE },
  { kind: 'notice', text: GONE_NOTICE },
  { kind: 'notice', text: GONE_DETAIL },
]
export const LONG_REFUSALS: readonly string[] = []

/** Words two or more sections show, defined here once (invariant 9) and imported by them. */
export const WORD_SHARE = 'Share'
export const WORD_COPY = 'Copy'
export const INTEGRATIONS = 'Integrations'
export const WORD_PERIOD = 'Period'
export const WORD_WEEK = 'Week'
export const WORD_MONTH = 'Month'
export const WORD_CHANGE = 'Change'
export const WORD_ADD_ANOTHER_VARIETY = 'Add another variety'
export const WORD_NOTE = 'Note'
export const WORD_VARIETY = 'Variety'
export const CHOOSE_A_VARIETY = 'Choose a variety'
export const WORD_GRAMS = 'Grams'
export const DATE_IN_FUTURE_REFUSAL = "The date can't be in the future"
export const PROMOTION = 'Promotion'
export const OWN_USE = 'Own use'
export const WORD_EDIT = 'Edit'
export const WORD_DELETE = 'Delete'
export const WORD_DATE = 'Date'
export const WORD_YES_DELETE_IT = 'Yes, delete it'
export const WORD_NO_KEEP_IT = 'No, keep it'
export const WORD_NO_KEEP_EDITING = 'No, keep editing'
export const DISCARD_THE_CHANGES = 'Discard the changes?'
export const WORD_YES_DISCARD_IT = 'Yes, discard it'
export const WORD_NO_KEEP_ENTERING = 'No, keep entering'
export const WORD_TAKE_OUT_OF_STOCK = 'Take out of stock'
export const WORD_COLLECT = 'Collect'
export const WORD_NAME = 'Name'
export const ENTERED_LOST_DETAIL = 'What you entered is lost: nothing has been saved yet.'
export const WORD_AMOUNT = 'Amount'
export const YES_DISCARD_THEM = 'Yes, discard them'
export const CATEGORY = 'Category'
export const SETTINGS = 'Settings'
export const INVITE_A_PARTNER = 'Invite a partner'
export const WORD_CATALOG_SAVED = 'Catalog saved'
export const USERS = 'Users'
export const WORD_PRICES = 'Prices'
export const CATALOG_MESSAGE = 'Catalog message'
export const EXPENSE_CATEGORIES = 'Expense categories'
export const DISCARD_THE_CHANGE = 'Discard the change?'
export const WORD_BULK_PRICE = 'Bulk price'
export const NO_KEEP_TYPING = 'No, keep typing'
