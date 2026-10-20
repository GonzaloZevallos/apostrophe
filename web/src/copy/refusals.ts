/**
 * The fixed text of every refusal the front words itself (plan, "Refusals", ADR-0008): a
 * screen never renders `detail`, and no text here repeats what the seller typed
 * (ADR-0005). `api/refusals.ts` keeps the dispatch on a code's kind and reads its text
 * from this section. Registered for `copyLimits.test.ts` like every section.
 */

import type { RefusalCode } from '../api/refusals'
import { GENERIC_REFUSAL_MESSAGE } from './common'
import type { LimitedCopy } from './limits'

/** Shown after a save or a delete lands on a record that is gone (plan, "Gone
 * records"): no id, name, date or amount, so it reads the same whatever was
 * deleted, foreign, or never existed (ADR-0004). Not a success toast. */
export { GONE_NOTICE } from './common'

/** Shown instead of a detail screen for a record that is gone, with no data of its
 * own (plan, "Gone records"). */
export { GONE_DETAIL } from './common'

/** Fixed text for `variety.name_archived`: the name belongs to an archived variety. It
 * repeats nothing the seller typed (ADR-0005). */
export const NAME_ARCHIVED_MESSAGE = 'That name belongs to an archived variety. Look for it in Archived.'

/** Fixed text for `variety.has_history`: a delete was refused because the variety has
 * sales or stock. It repeats no name or amount (ADR-0005). */
export const HAS_HISTORY_MESSAGE = 'This variety already has history: archive it instead of deleting it.'

/** The pinned catalog's own closed set of status reasons (plan, "Status"): the same
 * five codes `PinStatusOut.reason` answers, so the front's `PinReason` type and the table
 * below are the one place their fixed text is spelled out — the status line and a refused
 * Probarlo/Publicar (`PINNED_CATALOG_REFUSAL_OVERRIDES` below) share it for the reasons
 * they have in common, rather than each screen inventing its own copy of "Telegram no
 * respondió" or "El bot no puede publicar en el canal". */
export type PinReason =
  | 'telegram_unreachable'
  | 'bot_cannot_post'
  | 'message_gone'
  | 'missing_publish'
  | 'too_long'

export const PINNED_CATALOG_REASON_LABEL = {
  telegram_unreachable: "Telegram didn't respond",
  bot_cannot_post: "The bot can't post in the channel",
  message_gone: 'The pinned message is gone: publish it again',
  missing_publish: 'It still has to be published with the new bot or channel',
  too_long: "It's too long for Telegram: shorten aromas or hide varieties.",
} as const satisfies Record<PinReason, string>

export const PINNED_CATALOG_NOT_READY_REASON = 'Send yourself a test first to see how it looks'

/** What Probarlo says for each cause Telegram's refusal carries (the PRD's table): the
 * seller's own chat and token, never the channel. Fixed text, repeating nothing typed. */
const PROBARLO_TOKEN_INVALID_REASON = 'The token is not valid: copy it again from @BotFather.'
const PROBARLO_OWN_CHAT_NOT_STARTED_REASON =
  'Open your bot in Telegram and tap Start, then send the test again.'
const PROBARLO_OWN_CHAT_NOT_FOUND_REASON =
  'We could not find your chat: check the number and tap Start in your bot.'
const PROBARLO_TEST_FAILED_REASON = 'We could not send you the test: check the token and your chat.'

/** What Buscar mi chat says when it finds no one person (the PRD's table): fixed text,
 * repeating nothing typed and showing no name or number. */
const LOOKUP_NO_MESSAGES_REASON =
  'We see no messages in your bot yet: open it in Telegram, tap Start and search again.'
const LOOKUP_SEVERAL_CHATS_REASON =
  'More than one person wrote to your bot: look up your number with @userinfobot and type it here.'
const LOOKUP_UPDATES_UNREADABLE_REASON =
  "We could not read your bot's messages: look up your number with @userinfobot and type it here."

/** Every `pinned_catalog.*` code `contract.json` lists, mapped here exhaustively
 * (plan, "Front": "Map every `pinned_catalog.*` code in `web/src/api/refusals.ts`;
 * `too_long` uses the same text as the status") — `PinnedCatalogBot.tsx` reads this
 * instead of building its own override table, so a sixth code added to the contract
 * later has one place to be named, not two. */
type PinnedCatalogRefusalCode =
  | 'pinned_catalog.token_required'
  | 'pinned_catalog.own_chat_required'
  | 'pinned_catalog.not_ready'
  | 'pinned_catalog.too_long'
  | 'pinned_catalog.telegram_unreachable'
  | 'pinned_catalog.bot_cannot_post'
  | 'pinned_catalog.token_invalid'
  | 'pinned_catalog.own_chat_not_started'
  | 'pinned_catalog.own_chat_not_found'
  | 'pinned_catalog.test_failed'
  | 'pinned_catalog.no_messages'
  | 'pinned_catalog.several_chats'
  | 'pinned_catalog.updates_unreadable'

export const PINNED_CATALOG_REFUSAL_OVERRIDES = {
  'pinned_catalog.token_required': GENERIC_REFUSAL_MESSAGE,
  'pinned_catalog.own_chat_required': GENERIC_REFUSAL_MESSAGE,
  'pinned_catalog.not_ready': PINNED_CATALOG_NOT_READY_REASON,
  'pinned_catalog.too_long': PINNED_CATALOG_REASON_LABEL.too_long,
  'pinned_catalog.telegram_unreachable': PINNED_CATALOG_REASON_LABEL.telegram_unreachable,
  'pinned_catalog.bot_cannot_post': PINNED_CATALOG_REASON_LABEL.bot_cannot_post,
  'pinned_catalog.token_invalid': PROBARLO_TOKEN_INVALID_REASON,
  'pinned_catalog.own_chat_not_started': PROBARLO_OWN_CHAT_NOT_STARTED_REASON,
  'pinned_catalog.own_chat_not_found': PROBARLO_OWN_CHAT_NOT_FOUND_REASON,
  'pinned_catalog.test_failed': PROBARLO_TEST_FAILED_REASON,
  'pinned_catalog.no_messages': LOOKUP_NO_MESSAGES_REASON,
  'pinned_catalog.several_chats': LOOKUP_SEVERAL_CHATS_REASON,
  'pinned_catalog.updates_unreadable': LOOKUP_UPDATES_UNREADABLE_REASON,
} as const satisfies Record<PinnedCatalogRefusalCode, string>

/** The fixed text of the varieties refusal that has a field of its own: a VIP
 * price at or above the list price. It carries no amount (ADR-0005). */
export const VIP_PRICE_NOT_BELOW_LIST_MESSAGE = 'The VIP price has to be lower than the list price'

export const VARIETY_REFUSAL_TEXT: Partial<Record<RefusalCode, string>> = {
  'variety.vip_price_not_below_list': VIP_PRICE_NOT_BELOW_LIST_MESSAGE,
}

/** Fixed text for each coded refusal of a stock withdrawal (`stock.md`,
 * "Stock withdrawal"): the rule that was broken, never the note, the grams or an id
 * (ADR-0005). `stock.withdrawal_not_found` and `stock.withdrawal_variety_not_found`
 * are the two 404 codes: the form dispatches the first as a gone withdrawal and
 * answers the second on its lines, since the withdrawal itself still has somewhere to go. */
type WithdrawalRefusalCode =
  | 'stock.withdrawal_reason_required'
  | 'stock.withdrawal_date_in_future'
  | 'stock.withdrawal_no_lines'
  | 'stock.withdrawal_grams_not_positive'
  | 'stock.withdrawal_grams_too_precise'
  | 'stock.withdrawal_note_too_long'
  | 'stock.withdrawal_variety_not_found'

export const WITHDRAWAL_REFUSAL_MESSAGES = {
  'stock.withdrawal_reason_required': 'Choose a reason: Promotion or Own use',
  'stock.withdrawal_date_in_future': "The date can't be in the future",
  'stock.withdrawal_no_lines': 'Add at least one variety with its grams',
  'stock.withdrawal_grams_not_positive': 'The grams must be more than zero',
  'stock.withdrawal_grams_too_precise': 'The grams can have up to two decimals',
  'stock.withdrawal_note_too_long': 'The note can be up to 200 characters',
  'stock.withdrawal_variety_not_found': 'A variety is no longer there: choose another',
} as const satisfies Record<WithdrawalRefusalCode, string>

/** The refusals' texts are not always-visible copy: none is a help line, notice or empty
 * state, and the long ones are the pin's reasons, which `catalog.ts` measures behind
 * their "Desactualizado" title. */
/** Still the Spanish the app had: the Spanish rule (`architecture/copySpanish.ts`) skips a
 * section that says so. Removed with the section's English wording (ADR-0048). */
export const PENDING = true

export const LIMITED_COPY: readonly LimitedCopy[] = []
export const LONG_REFUSALS: readonly string[] = []
