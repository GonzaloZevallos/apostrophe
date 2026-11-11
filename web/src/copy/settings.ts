/**
 * The fixed words the business, users, account and catalog-message groups share with their tests (no JSX).
 * Toasts are typed on `SuccessToast`, so an invented message fails `tsc`. The generic retry
 * is not here: its one home is `ERROR_GENERICO_MENSAJE` in `components/ErrorGenerico`.
 */

import { baselineArgs, FIXTURE } from './baselineArgs.ts'
import type * as Self from './settings.ts'
import { SAMPLES, type LimitedCopy } from './limits.ts'
import { STOCK_TEXT } from './stock.ts'

export const LANGUAGE: 'es' | 'en' = 'en'

export const RENAME_SUCCESS = 'Saved'
export const PASSWORD_CHANGED_SUCCESS = 'Password changed · we signed out your other sessions'
export const BUSINESS_NAME_INVALID_MESSAGE = 'Give the business a name, without extra spaces'
export const GENERIC_REFUSAL_MESSAGE = 'Check the details and try again.'

/** Under an amount field the API refused with `money.too_many_decimals`: what to do, by the
 * decimals the business shows its money with. It names no currency, and the amount typed is
 * never repeated. */
export const moneyTooManyDecimals = (decimals: number): string =>
  decimals === 0 ? 'Use whole amounts only.' : `Use up to ${decimals} decimals.`
/** The help line under the Symbol field: examples, no list of currencies. No example carries a
 * money sign, because the phone check reads a label with one as a money amount's field. */
export const CURRENCY_SYMBOL_HINT = '1 to 4 characters, like EUR or CHF.'
export const CATALOG_SAVED = 'Catalog saved'
export const PRICES_SAVED = 'Prices saved'
export const HEADER_TOO_LONG_MESSAGE = 'The header is too long'
export const FOOTER_TOO_LONG_MESSAGE = 'The footer is too long'
/** The always-visible line under the Phone country control (a help line, <= 80). */
export const PHONE_COUNTRY_HELP = 'Applies to numbers you type from now on. Saved numbers don\'t change.'

/** The line under a fresh invitation link: one sentence, a help line (<= 80). `date` is `dd/mm`. */
export const inviteExpiry = (date: string): string => `A one-time link, it expires on ${date}`

/** The line under the Onboarding's collapsed "Category" action (a help line, <= 80): true because
 * adding, renaming and removing each save at once, through the owner's own routes. */
export const CATEGORIES_SAVE_AT_ONCE = 'Adding, renaming or removing a category saves right away.'

/** Every always-visible help line of these groups, measured with `SAMPLES`; the screens
 * render `inviteExpiry` itself. Checked by `copy/copyLimits.test.ts`. */
const LIMITED_COPY_0: readonly LimitedCopy[] = [
  { kind: 'help', text: inviteExpiry(SAMPLES.date) },
  { kind: 'help', text: CATEGORIES_SAVE_AT_ONCE },
  { kind: 'help', text: CURRENCY_SYMBOL_HINT },
  { kind: 'help', text: PHONE_COUNTRY_HELP },
  { kind: 'notice', text: moneyTooManyDecimals(0) },
  { kind: 'notice', text: moneyTooManyDecimals(2) },
]
/**
 * The fixed words of Configuración → Integraciones, shared with its test (no JSX). The
 * always-visible lines are listed in `LIMITED_COPY`, the same bindings the screen
 * renders, so `copy/copyLimits.test.ts` measures what the seller reads. The longer "how" for
 * the own chat is `OWN_CHAT_INFO.more`, behind `MasInfo`: only the how, never a consequence or a
 * fix. It is an object, not a string export, so the registry check does not read it as a line.
 */


export const CHANNEL_CHAT_HELP = 'The @username or link of the channel where the catalog is published.'
export const OWN_CHAT_HELP = 'Tap Start in your bot; find your number with @userinfobot.'
/** Behind More info: the longer how, which the always-visible line above says in short. */
export const OWN_CHAT_INFO = {
  line: OWN_CHAT_HELP,
  more: 'Open your bot in Telegram and tap Start. Then tap Find my chat and your number shows up on its own; or look it up with @userinfobot and type it here.',
} as const
export const LOAD_THE_TOKEN_FIRST = 'Enter the token first'
export const PREVIOUS_PIN_NOTICE =
  'The previous pinned message stays as it is; unpin it yourself in Telegram.'

const LIMITED_COPY_1: readonly LimitedCopy[] = [
  { kind: 'help', text: CHANNEL_CHAT_HELP },
  { kind: 'help', text: OWN_CHAT_HELP },
  { kind: 'help', text: LOAD_THE_TOKEN_FIRST },
  { kind: 'notice', text: PREVIOUS_PIN_NOTICE },
]

export const LIMITED_COPY: readonly LimitedCopy[] = [...LIMITED_COPY_0, ...LIMITED_COPY_1]
export const LONG_REFUSALS: readonly string[] = []


const { date: D } = FIXTURE

/** The fixture arguments of this file's functions, for `en.baseline.json` (`./baselineArgs.ts`). */
export const BASELINE_ARGS = baselineArgs<typeof Self>()({
  inviteExpiry: [[D]],
  moneyTooManyDecimals: [[0], [2]],
  'SETTINGS_TEXT.nameOf': [['Rosa']],
  'SETTINGS_TEXT.moveReasonUp': [['Marketing']],
  'SETTINGS_TEXT.moveReasonDown': [['Marketing']],
  'SETTINGS_TEXT.deleteReasonConfirm': [['Marketing']],
  languageName: [['en'], ['de'], ['xx']],
  phoneCountryName: [['AR'], ['xx']],
  'SETTINGS_TEXT.phoneCountryOption': [['Uruguay', '598']],
})

/** Every text a person reads in this area that is not a named message above, by key. */
export const SETTINGS_TEXT = {
  signOut: 'Sign out',
  theme: 'Theme',
  header: 'Header',
  footer: 'Footer',
  newCategory: 'New category',
  addCategory: '+ Category',
  nameOf: (name: string | number) => `Name of ${name}`,
  rename: 'Rename',
  delete: STOCK_TEXT.borrar,
  deleteTheCategory: 'Delete the category?',
  thisDeletes: 'This deletes “',
  closingQuoteCannotUndo: '”. This can\'t be undone.',
  botToken: 'Bot token',
  savedOn: 'Saved on ',
  notShownAgain: ' · not shown again',
  channelChat: 'Channel chat',
  yourChat: 'Your chat',
  findMyChat: 'Find my chat',
  testIt: 'Test it',
  goToCatalog: 'Go to the catalog',
  saveThePrices: 'Save the prices',
  you: 'you',
  categoryAmountAndDetails: 'Category, amount and details',
  stockOutWithoutSale: 'Stock out without a sale',
  byMonthAndByCategory: 'By month and by category',
  varietiesWeeksMonthsAndDays: 'Products, weeks, months and days',
  businessUsersBotCatalogAndMore: 'Business, users, bot, catalog, categories, appearance and your account',
  discardTheNewPassword: 'Discard the new password?',
  automatic: 'Automatic',
  automaticFollowsYourPhone: 'Automatic follows your phone.',
  light: 'Light',
  dark: 'Dark',
  discardTheName: 'Discard changes?',
  saveTheMessage: 'Save the message',
  discardTheMessage: 'Discard the message?',
  cannotDeleteStillHasExpenses: 'It can\'t be deleted: it still has expenses. You can rename it.',
  categorySaved: 'Category saved',
  categoryDeleted: 'Category deleted',
  discardTheCategory: 'Discard the category?',
  testSent: 'Test sent',
  invitationReady: 'Invitation ready',
  pastSalesKeepTheirPrice: 'Sales already made keep the price they were recorded with. Turning an option off deletes nothing.',
  discardThePrices: 'Discard the prices?',
  discardTheInvitation: 'Discard the invitation?',
  language: 'Language',
  languageGroupName: 'Language',
  withdrawalReasonsHint: 'The reasons you pick when you take stock out without selling it.',
  addWithdrawalReason: 'Add reason',
  moveReasonUp: (name: string) => `Move ${name} up`,
  moveReasonDown: (name: string) => `Move ${name} down`,
  moveUp: 'Up',
  moveDown: 'Down',
  reasonSaved: 'Reason saved',
  reasonDeleted: 'Reason deleted',
  cannotDeleteStillHasWithdrawals: 'It can\'t be deleted: it still has withdrawals. You can rename it.',
  cannotDeleteLastReason: 'It can\'t be deleted: you need at least one reason.',
  addReasonTitle: 'Add reason',
  renameReasonTitle: 'Rename reason',
  reasonNameBlank: 'Write a name.',
  reasonNameTooLong: 'Use 60 characters or fewer.',
  reasonNameDuplicate: 'You already have a reason with that name.',
  deleteReasonConfirm: (name: string) => `Delete the reason ${name}?`,
  reasonMoveFailed: 'The order wasn\'t saved. Try again.',
  currencySymbol: 'Symbol',
  currencySymbolHint: CURRENCY_SYMBOL_HINT,
  currencyDecimals: 'Decimals',
  currencyDecimals0: '0',
  currencyDecimals1: '1',
  currencyDecimals2: '2',
  currencyExample: 'Example',
  currencySaved: 'Currency and decimals saved',
  phoneCountryLabel: 'Phone country',
  phoneCountryHelp: PHONE_COUNTRY_HELP,
  phoneCountryNone: 'No country',
  phoneCountryAR: 'Argentina',
  phoneCountryUY: 'Uruguay',
  phoneCountryCL: 'Chile',
  phoneCountryPY: 'Paraguay',
  phoneCountryBR: 'Brazil',
  phoneCountryMX: 'Mexico',
  phoneCountryES: 'Spain',
  phoneCountryUS: 'United States',
  /** One option of the Phone country control: the country's name and its calling code, which the
   * API sends (the front never holds a code of its own). */
  phoneCountryOption: (name: string | number, calling_code: string | number) => `${name} (+${calling_code})`,
} as const

/** Each Phone country's name, keyed by its ISO code. A code with no entry shows the code itself. */
const PHONE_COUNTRY_NAMES: ReadonlyMap<string, string> = new Map([
  ['AR', SETTINGS_TEXT.phoneCountryAR],
  ['UY', SETTINGS_TEXT.phoneCountryUY],
  ['CL', SETTINGS_TEXT.phoneCountryCL],
  ['PY', SETTINGS_TEXT.phoneCountryPY],
  ['BR', SETTINGS_TEXT.phoneCountryBR],
  ['MX', SETTINGS_TEXT.phoneCountryMX],
  ['ES', SETTINGS_TEXT.phoneCountryES],
  ['US', SETTINGS_TEXT.phoneCountryUS],
])

export function phoneCountryName(code: string): string {
  return PHONE_COUNTRY_NAMES.get(code) ?? code
}

/** Each language's own name, fixed and the same whatever language is shown (invariant 7):
 * never translated per shown language. A tag with no entry shows the tag itself. */
const LANGUAGE_NAMES: ReadonlyMap<string, string> = new Map([
  ['en', 'English'],
  ['de', 'Deutsch'],
])

export function languageName(tag: string): string {
  return LANGUAGE_NAMES.get(tag) ?? tag
}
