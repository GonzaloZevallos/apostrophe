/**
 * Dispatches a backend refusal's `code` on its `kind` (plan, "Refusals", ADR-0008):
 * a screen never renders `detail`. `contract.json` is the shared contract the
 * backend's own tests check itself against (`tests/test_refusal_codes.py`), so a
 * rename on either side fails a check instead of quietly falling back here.
 */

import enRefusals from '../copy/locales/en/refusals.json' with { type: 'json' }
import refusalKeys from '../copy/refusalKeys.json' with { type: 'json' }
import { buildRefusalKeys, type Refusal, type RefusalKey } from '../i18n/refusalKeys.ts'
import contract from './contract.json' with { type: 'json' }

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

/** The key of every code in `copy/refusalKeys.json`, the one hand-kept code-to-key table:
 * built at import, so a code with no key, or a key `locales/en/refusals.json` lacks, stops the
 * app at load instead of showing the wrong words. */
export const REFUSAL_KEY: Record<RefusalCode, RefusalKey> = buildRefusalKeys(
  refusalKeys,
  enRefusals,
  Object.keys(refusalCodes).filter(isRefusalCode),
)

/** Shown after a save or a delete lands on a record that is gone (plan, "Gone
 * records"): no id, name, date or amount, so it reads the same whatever was
 * deleted, foreign, or never existed (ADR-0004). Not a success toast. */
export const GONE_NOTICE: Refusal = { key: 'refusals:goneNotice' }

/** Shown instead of a detail screen for a record that is gone, with no data of its
 * own (plan, "Gone records"). */
export const GONE_DETAIL: Refusal = { key: 'refusals:goneDetail' }

/** Fixed text for `variety.name_archived`: the name belongs to an archived variety. It
 * repeats nothing the seller typed (ADR-0005). */
export const NAME_ARCHIVED_MESSAGE: Refusal = { key: 'refusals:nameArchived' }

/** Fixed text for `variety.has_history`: a delete was refused because the variety has
 * sales or stock. It repeats no name or amount (ADR-0005). */
export const HAS_HISTORY_MESSAGE: Refusal = { key: 'refusals:hasHistory' }

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

/** Fixed text for `business.language_not_selectable`: a stale language screen. It names neither
 * the test locale nor why the value was refused. */
export const LANGUAGE_NOT_SELECTABLE_MESSAGE: Refusal = { key: 'refusals:languageNotSelectable' }

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

/** The key of each status reason; `too_long`, `telegram_unreachable` and `bot_cannot_post` are
 * also codes, and a test holds them equal to `REFUSAL_KEY`. */
export const PIN_REASON_KEY: Record<PinReason, RefusalKey> = {
  telegram_unreachable: 'refusals:pinReasonTelegramUnreachable',
  bot_cannot_post: 'refusals:pinReasonBotCannotPost',
  message_gone: 'refusals:pinReasonMessageGone',
  missing_publish: 'refusals:pinReasonMissingPublish',
  too_long: 'refusals:pinReasonTooLong',
}

/** The status reason's refusal, from `PIN_REASON_KEY`: the status line and a refused
 * Probarlo/Publicar share it. */
export const PINNED_CATALOG_REASON_LABEL: Record<PinReason, Refusal> = {
  telegram_unreachable: { key: PIN_REASON_KEY.telegram_unreachable },
  bot_cannot_post: { key: PIN_REASON_KEY.bot_cannot_post },
  message_gone: { key: PIN_REASON_KEY.message_gone },
  missing_publish: { key: PIN_REASON_KEY.missing_publish },
  too_long: { key: PIN_REASON_KEY.too_long },
}

export const PINNED_CATALOG_NOT_READY_REASON: Refusal = { key: 'refusals:pinnedNotReady' }

/** Every `pinned_catalog.*` code `contract.json` lists, mapped here exhaustively
 * (plan, "Front": "Map every `pinned_catalog.*` code in `web/src/api/refusals.ts`;
 * `too_long` uses the same text as the status") — `PinnedCatalogBot.tsx` reads this
 * instead of building its own override table, so a sixth code added to the contract
 * later has one place to be named, not two. Each value is the code's `REFUSAL_KEY`. */
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
  Refusal
> = {
  'pinned_catalog.token_required': { key: REFUSAL_KEY['pinned_catalog.token_required'] },
  'pinned_catalog.own_chat_required': { key: REFUSAL_KEY['pinned_catalog.own_chat_required'] },
  'pinned_catalog.not_ready': { key: REFUSAL_KEY['pinned_catalog.not_ready'] },
  'pinned_catalog.too_long': { key: REFUSAL_KEY['pinned_catalog.too_long'] },
  'pinned_catalog.telegram_unreachable': { key: REFUSAL_KEY['pinned_catalog.telegram_unreachable'] },
  'pinned_catalog.bot_cannot_post': { key: REFUSAL_KEY['pinned_catalog.bot_cannot_post'] },
  'pinned_catalog.token_invalid': { key: REFUSAL_KEY['pinned_catalog.token_invalid'] },
  'pinned_catalog.own_chat_not_started': { key: REFUSAL_KEY['pinned_catalog.own_chat_not_started'] },
  'pinned_catalog.own_chat_not_found': { key: REFUSAL_KEY['pinned_catalog.own_chat_not_found'] },
  'pinned_catalog.test_failed': { key: REFUSAL_KEY['pinned_catalog.test_failed'] },
  'pinned_catalog.no_messages': { key: REFUSAL_KEY['pinned_catalog.no_messages'] },
  'pinned_catalog.several_chats': { key: REFUSAL_KEY['pinned_catalog.several_chats'] },
  'pinned_catalog.updates_unreadable': { key: REFUSAL_KEY['pinned_catalog.updates_unreadable'] },
}

/** The fixed Spanish text of the varieties refusal that has a field of its own: a VIP
 * price at or above the list price. It carries no amount (ADR-0005). */
export const VIP_PRICE_NOT_BELOW_LIST_MESSAGE: Refusal = { key: 'refusals:vipPriceNotBelowList' }

export const VARIETY_REFUSAL_TEXT: Partial<Record<RefusalCode, Refusal>> = {
  'variety.vip_price_not_below_list': { key: REFUSAL_KEY['variety.vip_price_not_below_list'] },
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
  | 'stock.withdrawal_note_too_long'
  | 'stock.withdrawal_variety_not_found',
  Refusal
> = {
  'stock.withdrawal_reason_required': { key: REFUSAL_KEY['stock.withdrawal_reason_required'] },
  'stock.withdrawal_date_in_future': { key: REFUSAL_KEY['stock.withdrawal_date_in_future'] },
  'stock.withdrawal_no_lines': { key: REFUSAL_KEY['stock.withdrawal_no_lines'] },
  'stock.withdrawal_grams_not_positive': { key: REFUSAL_KEY['stock.withdrawal_grams_not_positive'] },
  'stock.withdrawal_note_too_long': { key: REFUSAL_KEY['stock.withdrawal_note_too_long'] },
  'stock.withdrawal_variety_not_found': { key: REFUSAL_KEY['stock.withdrawal_variety_not_found'] },
}
