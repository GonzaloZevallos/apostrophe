/**
 * Everything the setup steps and "All set" show. The step frame's two leave details are
 * shared with their tests and registered in `LIMITED_COPY` so `copy/copyLimits.test.ts`
 * measures the very bindings the dialogs show.
 */

import type { LimitedCopy } from './limits'
import {
  CATALOG_MESSAGE,
  EXPENSE_CATEGORIES,
  INTEGRATIONS,
  NO_KEEP_TYPING,
  SAVE,
  USERS,
  WORD_ADD_ANOTHER_VARIETY,
  WORD_NAME,
  WORD_YES_DISCARD_IT,
} from './common'
import { MORE_SETTINGS } from './expenses'
import { CHECKLIST_DONE, CHECKLIST_OPTIONAL, CHECKLIST_REQUIRED, STEP_STOCK_ENTRY } from './home'
import { TAB_VARIETIES } from './shell'

export const DISCARD_DETAIL = 'You lose what you typed: nothing has been saved yet.'
/** For a step that has already saved part of its work: the variety is kept, the price typed is not. */
export const PARTLY_SAVED_DETAIL = 'The variety is already saved; you lose the price you typed.'

/** The shared small words of the steps. */
export const CONTINUE = 'Continue'
export const BACK = 'Back'
export const SKIP = 'Skip'
export const SKIP_THE_REST = 'Skip the rest'

export const stepLine = (number: number, total: number) => `Step ${number} of ${total}`
export const stepsDone = (count: number, total: number) => `${count} of ${total} steps`
export const missingStep = (shortName: string) => `Missing: ${shortName}`
export const laterHint = (later: string) => `If you skip it, you do it later in ${later}.`

/** Where a skipped step is done later: "Settings → <group>". */
export const laterIn = (group: string) => `${MORE_SETTINGS} → ${group}`
export const LATER_VARIETIES = TAB_VARIETIES

/** The six steps: title, why, how the notice names it, how "All set" names it, the group it lives in. */
export const STEP_VARIETY_TITLE = 'Add your first variety'
export const STEP_VARIETY_WHY = 'To sell, each variety needs a name and its price for today.'
export const STEP_VARIETY_SHORT = 'variety with a price'
export const STEP_VARIETY_NAME = 'Variety with a price'

export const STEP_STOCK_WHY = "You can't sell without stock: tell us how many grams you have of this variety."
export const STEP_STOCK_SHORT = 'starting stock'
export const STEP_STOCK_NAME = 'Starting stock'

export const STEP_MESSAGE_TITLE = 'How your catalog looks'
export const STEP_MESSAGE_WHY = 'Header and footer go on every catalog you send: keep their text or edit it.'
export const STEP_MESSAGE_SHORT = 'catalog message'
export const STEP_MESSAGE_NAME = CATALOG_MESSAGE
export const STEP_MESSAGE_GROUP = CATALOG_MESSAGE

export const STEP_BOT_TITLE = 'Connect your Telegram bot'
export const STEP_BOT_WHY = 'With the bot, your catalog is published and updated on its own in your channel.'
export const STEP_BOT_SHORT = 'Telegram bot'
export const STEP_BOT_NAME = 'Telegram bot'
export const STEP_BOT_GROUP = INTEGRATIONS

export const STEP_PARTNER_TITLE = 'Send the link to your partner'
export const STEP_PARTNER_WHY = 'With the link your partner joins this business and sees what you see. No rush.'
export const STEP_PARTNER_SHORT = 'partner'
export const STEP_PARTNER_NAME = 'Partner'
export const STEP_PARTNER_GROUP = USERS

export const STEP_CATEGORIES_TITLE = EXPENSE_CATEGORIES
export const STEP_CATEGORIES_WHY = 'They sort what you spend. Add, rename or remove the usual ones as you like.'
export const STEP_CATEGORIES_SHORT = 'expense categories'
export const STEP_CATEGORIES_NAME = EXPENSE_CATEGORIES
export const STEP_CATEGORIES_GROUP = EXPENSE_CATEGORIES

/** The steps themselves. */
export const PUBLISH_LINE = `Whenever you want, publish it from ${TAB_VARIETIES} → Send catalog`
export const NOTICE_TITLE = 'Keep going with setup'
export const DISCARD_QUESTION = 'Discard what you typed?'
export const KEEP_TYPING = NO_KEEP_TYPING
export const DISCARD = WORD_YES_DISCARD_IT
export const LEAVE_AS_IS = 'Leave as is'
export const CREATE_THE_LINK = 'Create the link'

export const ANOTHER_PROMPT = 'Another one to add now? Each gets its name, its price and its starting stock.'
export const CARD_DETAIL = "With today's price and its starting stock"
export const ADD_ANOTHER_VARIETY = WORD_ADD_ANOTHER_VARIETY
export const ADD_VARIETY_FIRST = "First add a variety with its price for today."
export const ADD_A_VARIETY = 'Add a variety'

export const FIELD_NAME = WORD_NAME
export const savedVariety = (name: string) => `Variety: ${name}`
export const SAVE_THE_VARIETY = 'Save the variety'
export const perGramLine = (price: string) => `${price} x g`

/** "All set". */
export const ALL_SET = 'All set'
export const ALL_SET_LINE = 'This is what you have set up in your business.'
export const FIRST_SALE = 'Record my first sale'
export const GO_HOME = 'Go to Home'
export const laterLine = (later: string) => `For later — in ${later}`
export const doneVarieties = (n: number) => `Done · ${n === 1 ? '1 variety' : `${n} varieties`}`
export const doneEntries = (n: number) => `Done · ${n === 1 ? '1 entry' : `${n} entries`}`

export const LIMITED_COPY: readonly LimitedCopy[] = [
  { kind: 'help', text: DISCARD_DETAIL },
  { kind: 'help', text: PARTLY_SAVED_DETAIL },
]

export const LONG_REFUSALS: readonly string[] = []

/** Words owned by another section, imported read-only and re-exported under the names the steps use. */
export const DONE = CHECKLIST_DONE
export const REQUIRED = CHECKLIST_REQUIRED
export const OPTIONAL = CHECKLIST_OPTIONAL
export const STEP_STOCK_TITLE = STEP_STOCK_ENTRY
export { SAVE }
