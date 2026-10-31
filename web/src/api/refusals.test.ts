import { describe, expect, test } from 'vitest'
import enRefusals from '../copy/locales/en/refusals.json' with { type: 'json' }
import { NOT_READY_LINE, OUT_OF_DATE_LINES, OUT_OF_DATE_TOO_LONG_LINE } from '../copy/pinnedCatalog'
import { resolveKey } from '../i18n/resolve'
import {
  GONE_DETAIL,
  GONE_NOTICE,
  isGone,
  kindOf,
  PINNED_CATALOG_NOT_READY_REASON,
  PINNED_CATALOG_REFUSAL_OVERRIDES,
  PIN_REASON_KEY,
  REFUSAL_KEY,
  resolveOverride,
  VARIETY_REFUSAL_TEXT,
  WITHDRAWAL_REFUSAL_MESSAGES,
  type PinReason,
  type RefusalCode,
} from './refusals'

const en = { refusals: enRefusals }

describe('kindOf', () => {
  test('reads a refusal code\'s kind from the shared contract', () => {
    expect(kindOf('customer.phone_taken')).toBe('refusal')
  })

  test('reads a 404 code as gone', () => {
    expect(kindOf('customer.not_found')).toBe('gone')
  })

  test('never reads a code the contract does not list as gone', () => {
    // An unrecognised code must still read as a refusal, not silently vanish a
    // record that is still there (the contrary would hide a real contract drift).
    expect(kindOf('made_up.code')).toBe('refusal')
  })
})

describe('isGone', () => {
  test('agrees with kindOf', () => {
    expect(isGone('variety.price_entry_not_found')).toBe(true)
    expect(isGone('variety.archived')).toBe(true)
    expect(isGone('variety.name_taken')).toBe(false)
  })
})

describe('the fixed copy', () => {
  test('carries no data of its own', () => {
    expect(resolveKey(en, GONE_NOTICE.key)).toBe('That is gone. The list is up to date.')
    expect(resolveKey(en, GONE_DETAIL.key)).toBe('That is gone.')
  })
})

describe('the exported tables hold the key of their code', () => {
  test('each pinned catalog override is REFUSAL_KEY of its code', () => {
    const codes = [
      'pinned_catalog.token_required',
      'pinned_catalog.own_chat_required',
      'pinned_catalog.not_ready',
      'pinned_catalog.too_long',
      'pinned_catalog.telegram_unreachable',
      'pinned_catalog.bot_cannot_post',
      'pinned_catalog.token_invalid',
      'pinned_catalog.own_chat_not_started',
      'pinned_catalog.own_chat_not_found',
      'pinned_catalog.test_failed',
      'pinned_catalog.no_messages',
      'pinned_catalog.several_chats',
      'pinned_catalog.updates_unreadable',
    ] satisfies RefusalCode[]
    for (const code of codes) {
      expect(PINNED_CATALOG_REFUSAL_OVERRIDES[code]).toEqual({ key: REFUSAL_KEY[code] })
    }
  })

  test('each withdrawal message is REFUSAL_KEY of its code', () => {
    const codes = [
      'stock.withdrawal_reason_required',
      'stock.withdrawal_date_in_future',
      'stock.withdrawal_no_lines',
      'stock.withdrawal_grams_not_positive',
      'stock.withdrawal_note_too_long',
      'stock.withdrawal_variety_not_found',
    ] satisfies RefusalCode[]
    for (const code of codes) {
      expect(WITHDRAWAL_REFUSAL_MESSAGES[code]).toEqual({ key: REFUSAL_KEY[code] })
    }
  })

  test('the VIP price rule is REFUSAL_KEY of its code', () => {
    expect(VARIETY_REFUSAL_TEXT['variety.vip_price_not_below_list']).toEqual({
      key: REFUSAL_KEY['variety.vip_price_not_below_list'],
    })
  })
})

describe('copy/pinnedCatalog.ts inlines the English of the refusals', () => {
  test('the not-ready line starts with the not-ready reason', () => {
    expect(NOT_READY_LINE.startsWith(`${resolveKey(en, PINNED_CATALOG_NOT_READY_REASON.key)} · `)).toBe(true)
  })

  test('each out-of-date line ends with the English of its reason key', () => {
    expect(OUT_OF_DATE_TOO_LONG_LINE.endsWith(resolveKey(en, PIN_REASON_KEY.too_long))).toBe(true)
    for (const reason of ['telegram_unreachable', 'bot_cannot_post', 'message_gone', 'missing_publish'] satisfies PinReason[]) {
      expect(OUT_OF_DATE_LINES[reason].endsWith(resolveKey(en, PIN_REASON_KEY[reason]))).toBe(true)
    }
  })
})

describe('resolveOverride', () => {
  // Naming a code the contract does not list — `'invitacion.vencida'` below — must
  // fail `tsc`, not just return `undefined` at runtime. Uncommenting this line is
  // the check for that; it does not compile (verified by hand, not kept committed):
  //   resolveOverride({ 'invitacion.vencida': 'x' }, 'account.invitation_not_usable')
  test('finds the override a screen named for a code the contract lists', () => {
    const overrides: Partial<Record<RefusalCode, string>> = {
      'account.invitation_not_usable': 'This invitation no longer works',
    }

    expect(resolveOverride(overrides, 'account.invitation_not_usable')).toBe(
      'This invitation no longer works',
    )
  })

  test('finds nothing for a code that has no override', () => {
    const overrides = { 'account.invitation_not_usable': 'This invitation no longer works' }

    expect(resolveOverride(overrides, 'account.email_taken')).toBeUndefined()
  })

  test('finds nothing for a code the contract does not list at all', () => {
    const overrides = { 'account.invitation_not_usable': 'This invitation no longer works' }

    expect(resolveOverride(overrides, 'made_up.code')).toBeUndefined()
  })
})
