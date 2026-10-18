/**
 * The fixed words of Settings — the business, users, prices, account, catalog-message,
 * expense-categories and Integrations groups — shared with their tests (no JSX). Toasts are
 * strings from here, never a literal of a screen. The generic retry is not here: its one
 * home is `ERROR_GENERICO_MENSAJE` in `states.ts`. The longer "how" for the own chat is
 * `OWN_CHAT_INFO.more`, behind `MasInfo`: only the how, never a consequence or a fix. It is
 * an object, not a string export, so the registry check does not read it as a line.
 */

import { SAMPLES, type LimitedCopy } from './limits'
import type { SuccessToast } from '../components/AvisoExito'

export const RENAME_SUCCESS: SuccessToast = 'Business renamed'
export const PASSWORD_CHANGED_SUCCESS: SuccessToast = 'Password changed · we signed out your other sessions'
export const BUSINESS_NAME_INVALID_MESSAGE = 'Give the business a name, without extra spaces'
export const CATALOG_SAVED: SuccessToast = 'Catalog saved'
export const PRICES_SAVED: SuccessToast = 'Prices saved'
export const HEADER_TOO_LONG_MESSAGE = 'The header is too long'
export const FOOTER_TOO_LONG_MESSAGE = 'The footer is too long'

/** The line under a fresh invitation link: one sentence, a help line (<= 80). `date` is `dd/mm`. */
export const inviteExpiry = (date: string): string => `Single-use link, expires on ${date}`

/** The line under the Onboarding's collapsed "Category" action (a help line, <= 80): true because
 * adding, renaming and removing each save at once, through the owner's own routes. */
export const CATEGORIES_SAVE_AT_ONCE = 'Adding, renaming or removing a category saves right away.'

export const CHANNEL_CHAT_HELP = 'The @username or link of the channel where the catalog is posted.'
export const OWN_CHAT_HELP = 'Tap Start in your bot; you can see your number with @userinfobot.'
/** Behind More info: the longer how, which the always-visible line above says in short. */
export const OWN_CHAT_INFO = {
  line: OWN_CHAT_HELP,
  more: 'Open your bot in Telegram and tap Start. Then tap Find my chat and your number shows up by itself; or look it up with @userinfobot and type it here.',
} as const
export const LOAD_THE_TOKEN_FIRST = 'Enter the token first'
export const PREVIOUS_PIN_NOTICE =
  'The previous pinned message stays as it is; unpin it yourself in Telegram.'

/** The groups' names, the Settings title and the menu's accessible name. */
export const SETTINGS_TITLE = 'Settings'
export const GROUP_BUSINESS = 'Business'
export const GROUP_USERS = 'Users'
export const GROUP_PRICES = 'Prices'
export const GROUP_INTEGRATIONS = 'Integrations'
export const GROUP_CATALOG_MESSAGE = 'Catalog message'
export const GROUP_EXPENSE_CATEGORIES = 'Expense categories'
export const GROUP_APPEARANCE = 'Appearance'
export const GROUP_ACCOUNT = 'Your account'

/** What each group's leave confirmation asks: one wording per group, one shared detail. */
const LEAVE_DETAIL = 'What you entered is lost: nothing has been saved yet.'
const leaveWording = (question: string, discard: string) => ({
  question,
  detail: LEAVE_DETAIL,
  keepLabel: 'No, keep editing',
  discardLabel: discard,
})
export const LEAVE_PASSWORD = leaveWording('Discard the new password?', 'Yes, discard it')
export const LEAVE_THEME = leaveWording('Discard the theme?', 'Yes, discard it')
export const LEAVE_BUSINESS_NAME = leaveWording('Discard the name?', 'Yes, discard it')
export const LEAVE_CATALOG_MESSAGE = leaveWording('Discard the message?', 'Yes, discard it')
export const LEAVE_INVITATION = leaveWording('Discard the invitation?', 'Yes, discard it')
export const LEAVE_PRICES = leaveWording('Discard the prices?', 'Yes, discard them')
export const LEAVE_CATEGORY = leaveWording('Discard the category?', 'Yes, discard it')
export const LEAVE_CHANGE = leaveWording('Discard the change?', 'Yes, discard it')

/** Business and Your account. */
export const SAVE_NAME = 'Save the name'
export const LOG_OUT = 'Log out'

/** Users and the partner invitation. */
export const YOU_MARK = 'you'
export const INVITE_PARTNER = 'Invite a partner'
export const COPY_LINK = 'Copy'
export const SHARE_LINK = 'Share'

/** Appearance. */
export const THEME_LABEL = 'Theme'
export const THEME_LIGHT = 'Light'
export const THEME_DARK = 'Dark'

/** Prices. */
export const BULK_PRICING_LABEL = 'Bulk pricing'
export const VIP_CUSTOMERS_LABEL = 'VIP customers'
export const SAVE_PRICES = 'Save the prices'
export const PAST_SALES_LINE = 'Past sales keep their recorded price. Turning an option off deletes nothing.'
export const VIP_HELP_LINE = 'Each variety needs a VIP price: without one, VIP customers pay the usual price.'

/** Catalog message. */
export const HEADER_LABEL = 'Header'
export const FOOTER_LABEL = 'Footer'
export const SAVE_MESSAGE = 'Save the message'

/** Expense categories. */
export const CATEGORY_SAVED: SuccessToast = 'Category saved'
export const CATEGORY_REMOVED: SuccessToast = 'Category deleted'
export const CANNOT_REMOVE = "Can't delete it: it still has expenses. You can rename it."
export const NEW_CATEGORY_LABEL = 'New category'
export const ADD_CATEGORY_FORM = '+ Category'
export const ADD_CATEGORY = 'Category'
export const RENAME = 'Rename'
export const DELETE = 'Delete'
export const nameOf = (category: string) => `Name of ${category}`
export const DELETE_CATEGORY_QUESTION = 'Delete the category?'
export const deleteCategoryDetail = (category: string) =>
  `“${category}” will be deleted. This can't be undone.`
export const KEEP_IT = 'No, keep it'
export const DELETE_IT = 'Yes, delete it'

/** Integrations. */
export const TEST_SENT_TOAST: SuccessToast = 'Test sent'
export const BOT_TOKEN_LABEL = 'Bot token'
export const tokenSavedOn = (date: string) => `Saved on ${date} · not shown again`
export const CHANGE = 'Change'
export const CHANNEL_CHAT_LABEL = 'Channel chat'
export const OWN_CHAT_LABEL = 'Your chat'
export const FIND_MY_CHAT = 'Find my chat'
export const SEND_ME_A_TEST = 'Send me a test'
export const GO_TO_CATALOG = 'Go to the catalog'

/** Every always-visible help line of these groups, measured with `SAMPLES`; the screens
 * render `inviteExpiry` itself. Checked by `copy/copyLimits.test.ts`. */
export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'help', text: inviteExpiry(SAMPLES.date) },
  { kind: 'help', text: CATEGORIES_SAVE_AT_ONCE },
  { kind: 'help', text: CHANNEL_CHAT_HELP },
  { kind: 'help', text: OWN_CHAT_HELP },
  { kind: 'help', text: LOAD_THE_TOKEN_FIRST },
  { kind: 'notice', text: PREVIOUS_PIN_NOTICE },
]
export const LONG_REFUSALS: readonly string[] = []
