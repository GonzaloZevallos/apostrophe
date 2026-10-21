/**
 * The fixed words the business, users, account and catalog-message groups share with their tests (no JSX).
 * Toasts are typed on `SuccessToast`, so an invented message fails `tsc`. The generic retry
 * is not here: its one home is `ERROR_GENERICO_MENSAJE` in `components/ErrorGenerico`.
 */

import { SAMPLES, type LimitedCopy } from './limits'
import { REFUSAL_TEXT } from './refusals'

export const LANGUAGE: 'es' | 'en' = 'en'

export const RENAME_SUCCESS = 'Business renamed'
export const PASSWORD_CHANGED_SUCCESS = 'Password changed · we signed out your other sessions'
export const BUSINESS_NAME_INVALID_MESSAGE = 'Give the business a name, without extra spaces'
export const GENERIC_REFUSAL_MESSAGE = REFUSAL_TEXT.pinnedGeneric
export const CATALOG_SAVED = 'Catalog saved'
export const PRICES_SAVED = 'Prices saved'
export const HEADER_TOO_LONG_MESSAGE = 'The header is too long'
export const FOOTER_TOO_LONG_MESSAGE = 'The footer is too long'

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
  delete: 'Delete',
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
  vipCustomers: 'VIP customers',
  saveThePrices: 'Save the prices',
  you: 'you',
  categoryAmountAndDetails: 'Category, amount and details',
  promotionOrOwnUse: 'Promotion or own use',
  byMonthAndByCategory: 'By month and by category',
  varietiesWeeksMonthsAndDays: 'Varieties, weeks, months and days',
  businessUsersBotCatalogAndMore: 'Business, users, bot, catalog, categories, appearance and your account',
  discardTheNewPassword: 'Discard the new password?',
  light: 'Light',
  dark: 'Dark',
  discardTheTheme: 'Discard the theme?',
  discardTheName: 'Discard the name?',
  saveTheMessage: 'Save the message',
  discardTheMessage: 'Discard the message?',
  cannotDeleteStillHasExpenses: 'It can\'t be deleted: it still has expenses. You can rename it.',
  categorySaved: 'Category saved',
  categoryDeleted: 'Category deleted',
  discardTheCategory: 'Discard the category?',
  testSent: 'Test sent',
  invitationReady: 'Invitation ready',
  pastSalesKeepTheirPrice: 'Sales already made keep the price they were recorded with. Turning an option off deletes nothing.',
  eachVarietyNeedsItsVipPrice: 'Each variety needs its VIP price: without it, a VIP customer pays like anyone else.',
  discardThePrices: 'Discard the prices?',
  discardTheInvitation: 'Discard the invitation?',
} as const
