import { describe, expect, test } from 'vitest'
import contract from './contract.json'
import {
  GONE_DETAIL,
  GONE_NOTICE,
  isGone,
  kindOf,
  resolveOverride,
  WITHDRAWAL_REFUSAL_MESSAGES,
  type RefusalCode,
} from './refusals'

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
    expect(isGone('variety.name_taken')).toBe(false)
  })
})

describe('the fixed copy', () => {
  test('carries no data of its own', () => {
    expect(GONE_NOTICE).toBe('Eso ya no está. La lista ya está al día.')
    expect(GONE_DETAIL).toBe('Eso ya no está.')
  })
})

describe('resolveOverride', () => {
  // Naming a code the contract does not list — `'invitacion.vencida'` below — must
  // fail `tsc`, not just return `undefined` at runtime. Uncommenting this line is
  // the check for that; it does not compile (verified by hand, not kept committed):
  //   resolveOverride({ 'invitacion.vencida': 'x' }, 'account.invitation_not_usable')
  test('finds the override a screen named for a code the contract lists', () => {
    const overrides: Partial<Record<RefusalCode, string>> = {
      'account.invitation_not_usable': 'Esta invitación ya no sirve',
    }

    expect(resolveOverride(overrides, 'account.invitation_not_usable')).toBe(
      'Esta invitación ya no sirve',
    )
  })

  test('finds nothing for a code that has no override', () => {
    const overrides = { 'account.invitation_not_usable': 'Esta invitación ya no sirve' }

    expect(resolveOverride(overrides, 'account.email_taken')).toBeUndefined()
  })

  test('finds nothing for a code the contract does not list at all', () => {
    const overrides = { 'account.invitation_not_usable': 'Esta invitación ya no sirve' }

    expect(resolveOverride(overrides, 'made_up.code')).toBeUndefined()
  })
})

describe('the withdrawal refusals', () => {
  test('every refusal-kind withdrawal code has its fixed Spanish text, naming no data', () => {
    const codes = Object.keys(contract.refusalCodes).filter((code) => code.startsWith('stock.withdrawal_'))
    expect(codes).toHaveLength(8)
    for (const code of codes) {
      const message = resolveOverride(WITHDRAWAL_REFUSAL_MESSAGES, code)
      if (kindOf(code) === 'gone' && code === 'stock.withdrawal_not_found') {
        expect(message).toBeUndefined()
      } else {
        expect(message, code).toBeTypeOf('string')
      }
    }
  })
})
