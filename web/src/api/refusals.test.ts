import { describe, expect, test } from 'vitest'
import { GONE_DETAIL, GONE_NOTICE, isGone, kindOf } from './refusals'

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
