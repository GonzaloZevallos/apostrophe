/**
 * The words the backend's refusals turn into for a person (ADR-0005, ADR-0049): fixed text,
 * repeating nothing typed. `api/refusals.ts` keeps the dispatch and the types, and reads
 * its texts from here. They sit in one object, not in string exports, so the registry
 * check does not read them as lines (the long ones are refusals aimed at 80, kept with
 * their fix).
 */

import { COMMON_TEXT } from './common.ts'
import type { LimitedCopy } from './limits.ts'

export const LANGUAGE: 'es' | 'en' = 'en'

export const REFUSAL_TEXT = {
  goneNotice: 'That is gone. The list is up to date.',
  goneDetail: 'That is gone.',
  nameArchived: 'That name belongs to an archived variety. Look for it in Archived.',
  hasHistory: 'This variety already has history: archive it instead of deleting it.',
  pinnedGeneric: 'Check the details and try again.',
  pinnedNotReady: 'Test it first to see how it looks',
  probarloTokenInvalid: 'The token is not valid: copy it again from @BotFather.',
  probarloOwnChatNotStarted: 'Open your bot in Telegram and tap Start, then test it again.',
  probarloOwnChatNotFound: 'We could not find your chat: check the number and tap Start in your bot.',
  probarloTestFailed: 'We could not send you the test: check the token and your chat.',
  lookupNoMessages: 'We see no messages in your bot yet: open it in Telegram, tap Start, and look again.',
  lookupSeveralChats: 'More than one person wrote to your bot: find your number with @userinfobot and type it here.',
  lookupUpdatesUnreadable: 'We could not read your bot\'s messages: find your number with @userinfobot and type it here.',
  vipPriceNotBelowList: 'The VIP price has to be lower than the list price',
  pinReason: {
    telegram_unreachable: 'Telegram did not respond',
    bot_cannot_post: 'The bot cannot post in the channel',
    message_gone: 'The pinned message is gone: publish it again',
    missing_publish: 'It still has to be published with the new bot or channel',
    too_long: 'It is too long for Telegram: shorten aromas or hide varieties.',
  },
  withdrawal: {
    'stock.withdrawal_reason_required': 'Pick the reason: Promotion or Own use',
    'stock.withdrawal_date_in_future': COMMON_TEXT.dateCannotBeFuture,
    'stock.withdrawal_no_lines': 'Add at least one variety with its grams',
    'stock.withdrawal_grams_not_positive': 'Grams have to be more than zero',
    'stock.withdrawal_grams_too_precise': 'Grams allow up to two decimals',
    'stock.withdrawal_note_too_long': 'The note allows up to 200 characters',
    'stock.withdrawal_variety_not_found': 'A variety is gone: pick another',
  },
} as const

export const LIMITED_COPY: readonly LimitedCopy[] = []
export const LONG_REFUSALS: readonly string[] = []
