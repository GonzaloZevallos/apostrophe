/**
 * Dispatches a backend refusal's `code` on its `kind` (plan, "Refusals", ADR-0008):
 * a screen never renders `detail`. `contract.json` is the shared contract the
 * backend's own tests check itself against (`tests/test_refusal_codes.py`), so a
 * rename on either side fails a check instead of quietly falling back here.
 */

import contract from './contract.json'

export type RefusalKind = 'refusal' | 'gone'

/** Every code the backend can answer with, exactly as `contract.json` lists them
 * (its keys, not widened to a bare `string`): a screen that overrides a renamed or
 * misspelt code fails `tsc` here, not silently at runtime. */
export type RefusalCode = keyof (typeof contract)['refusalCodes']

// The contract's own values are always one of RefusalKind — the backend's own test
// checks it (`tests/test_refusal_codes.py`) — so only the `kind` field's literal type
// needs this assertion. `RefusalCode` above is derived before this cast and is never
// itself widened: it stays exactly contract.json's own set of keys.
const refusalCodes = contract.refusalCodes as Record<RefusalCode, { kind: RefusalKind }>

function isRefusalCode(code: string): code is RefusalCode {
  return code in refusalCodes
}

/** Shown after a save or a delete lands on a record that is gone (plan, "Gone
 * records"): no id, name, date or amount, so it reads the same whatever was
 * deleted, foreign, or never existed (ADR-0004). Not a success toast. */
export const GONE_NOTICE = 'Eso ya no está. La lista ya está al día.'

/** Shown instead of a detail screen for a record that is gone, with no data of its
 * own (plan, "Gone records"). */
export const GONE_DETAIL = 'Eso ya no está.'

/** A code's kind, from the shared contract. The parameter stays a plain `string`
 * because a code comes in untyped off the wire (`ApiError.code`); a code the
 * contract does not list is never read as `'gone'`: an unrecognised refusal must
 * still read as a refusal, not silently vanish a record that is still there. */
export function kindOf(code: string): RefusalKind {
  return isRefusalCode(code) ? refusalCodes[code].kind : 'refusal'
}

export function isGone(code: string): boolean {
  return kindOf(code) === 'gone'
}

/**
 * A screen overrides how one or more codes are handled by naming them here instead
 * of relying on the kind's default (plan, "Refusals": "A screen may override how a
 * code is handled, by naming the code."). `overrides` is typed on `RefusalCode`, so
 * naming a code the contract does not list — a typo, or one renamed on the backend
 * side — fails `tsc` in the screen that wrote it, instead of silently falling back
 * to the generic kind-based text at runtime.
 */
export function resolveOverride<T>(
  overrides: Partial<Record<RefusalCode, T>>,
  code: string,
): T | undefined {
  return isRefusalCode(code) ? overrides[code] : undefined
}

/** The pinned catalog's own closed set of status reasons (plan, "Status"): the same
 * five codes `PinStatusOut.reason` answers, so the front's `PinReason` type and this
 * table are the one place their fixed Spanish text is spelled out — the status line
 * and a refused Probarlo/Publicar (`PINNED_CATALOG_REFUSAL_OVERRIDES` below) share it
 * for the reasons they have in common, rather than each screen inventing its own
 * copy of "Telegram no respondió" or "El bot no puede publicar en el canal". */
export type PinReason =
  | 'telegram_unreachable'
  | 'bot_cannot_post'
  | 'message_gone'
  | 'missing_publish'
  | 'too_long'

export const PINNED_CATALOG_REASON_LABEL: Record<PinReason, string> = {
  telegram_unreachable: 'Telegram no respondió',
  bot_cannot_post: 'El bot no puede publicar en el canal',
  message_gone: 'El mensaje fijado ya no está: publicalo de nuevo',
  missing_publish: 'Falta publicarlo con el bot o el canal nuevo',
  too_long: 'Es demasiado largo para Telegram: acortá aromas u ocultá variedades.',
}

const PINNED_CATALOG_GENERIC_REFUSAL = 'Revisá los datos e intentá de nuevo.'
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
export const PINNED_CATALOG_REFUSAL_OVERRIDES: Record<
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
  | 'pinned_catalog.updates_unreadable',
  string
> = {
  'pinned_catalog.token_required': PINNED_CATALOG_GENERIC_REFUSAL,
  'pinned_catalog.own_chat_required': PINNED_CATALOG_GENERIC_REFUSAL,
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
}

/** Fixed Spanish text for each coded refusal of a stock withdrawal (`stock.md`,
 * "Stock withdrawal"): the rule that was broken, never the note, the grams or an id
 * (ADR-0005). `stock.withdrawal_not_found` and `stock.withdrawal_variety_not_found`
 * are the two 404 codes: the form dispatches the first as a gone withdrawal and
 * answers the second on its lines, since the withdrawal itself still has somewhere to go. */
export const WITHDRAWAL_REFUSAL_MESSAGES: Record<
  | 'stock.withdrawal_reason_required'
  | 'stock.withdrawal_date_in_future'
  | 'stock.withdrawal_no_lines'
  | 'stock.withdrawal_grams_not_positive'
  | 'stock.withdrawal_grams_too_precise'
  | 'stock.withdrawal_note_too_long'
  | 'stock.withdrawal_variety_not_found',
  string
> = {
  'stock.withdrawal_reason_required': 'Elegí el motivo: Promoción o Consumo propio',
  'stock.withdrawal_date_in_future': 'La fecha no puede ser futura',
  'stock.withdrawal_no_lines': 'Agregá al menos una variedad con sus gramos',
  'stock.withdrawal_grams_not_positive': 'Los gramos tienen que ser más que cero',
  'stock.withdrawal_grams_too_precise': 'Los gramos admiten hasta dos decimales',
  'stock.withdrawal_note_too_long': 'La nota admite hasta 200 caracteres',
  'stock.withdrawal_variety_not_found': 'Alguna variedad ya no está: elegí otra',
}
