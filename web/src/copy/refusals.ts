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
export const NAME_ARCHIVED_MESSAGE = 'Ese nombre es de una variedad archivada. Buscala en Archivadas.'

/** Fixed text for `variety.has_history`: a delete was refused because the variety has
 * sales or stock. It repeats no name or amount (ADR-0005). */
export const HAS_HISTORY_MESSAGE = 'Esta variedad ya tiene historia: archivala en vez de eliminarla.'

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
  telegram_unreachable: 'Telegram no respondió',
  bot_cannot_post: 'El bot no puede publicar en el canal',
  message_gone: 'El mensaje fijado ya no está: publicalo de nuevo',
  missing_publish: 'Falta publicarlo con el bot o el canal nuevo',
  too_long: 'Es demasiado largo para Telegram: acortá aromas u ocultá variedades.',
} as const satisfies Record<PinReason, string>

export const PINNED_CATALOG_NOT_READY_REASON = 'Probalo primero para ver cómo queda'

/** What Probarlo says for each cause Telegram's refusal carries (the PRD's table): the
 * seller's own chat and token, never the channel. Fixed text, repeating nothing typed. */
const PROBARLO_TOKEN_INVALID_REASON = 'El token no es válido: copialo de nuevo de @BotFather.'
const PROBARLO_OWN_CHAT_NOT_STARTED_REASON =
  'Abrí tu bot en Telegram y tocá Iniciar, después probalo de nuevo.'
const PROBARLO_OWN_CHAT_NOT_FOUND_REASON =
  'No encontramos tu chat: revisá el número y tocá Iniciar en tu bot.'
const PROBARLO_TEST_FAILED_REASON = 'No pudimos enviarte la prueba: revisá el token y tu chat.'

/** What Buscar mi chat says when it finds no one person (the PRD's table): fixed text,
 * repeating nothing typed and showing no name or number. */
const LOOKUP_NO_MESSAGES_REASON =
  'Todavía no vemos mensajes en tu bot: abrilo en Telegram, tocá Iniciar y buscá de nuevo.'
const LOOKUP_SEVERAL_CHATS_REASON =
  'Le escribió más de una persona a tu bot: buscá tu número con @userinfobot y escribilo acá.'
const LOOKUP_UPDATES_UNREADABLE_REASON =
  'No pudimos leer los mensajes de tu bot: buscá tu número con @userinfobot y escribilo acá.'

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
export const VIP_PRICE_NOT_BELOW_LIST_MESSAGE = 'El precio VIP tiene que ser menor al precio de lista'

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
  'stock.withdrawal_reason_required': 'Elegí el motivo: Promoción o Consumo propio',
  'stock.withdrawal_date_in_future': 'La fecha no puede ser futura',
  'stock.withdrawal_no_lines': 'Agregá al menos una variedad con sus gramos',
  'stock.withdrawal_grams_not_positive': 'Los gramos tienen que ser más que cero',
  'stock.withdrawal_grams_too_precise': 'Los gramos admiten hasta dos decimales',
  'stock.withdrawal_note_too_long': 'La nota admite hasta 200 caracteres',
  'stock.withdrawal_variety_not_found': 'Alguna variedad ya no está: elegí otra',
} as const satisfies Record<WithdrawalRefusalCode, string>

/** The refusals' texts are not always-visible copy: none is a help line, notice or empty
 * state, and the long ones are the pin's reasons, which `catalog.ts` measures behind
 * their "Desactualizado" title. */
/** Still the Spanish the app had: the Spanish rule (`architecture/copySpanish.ts`) skips a
 * section that says so. Removed with the section's English wording (ADR-0048). */
export const PENDING = true

export const LIMITED_COPY: readonly LimitedCopy[] = []
export const LONG_REFUSALS: readonly string[] = []
