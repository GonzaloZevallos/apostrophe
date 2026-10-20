import { describe, expect, test } from 'vitest'
import { PENDING_TAPS, showsPending } from './pending.ts'
import { SCREEN_NAMES } from './registry.ts'

describe('showsPending', () => {
  test('a button that refuses a second tap and says a new word is pending', () => {
    expect(showsPending('Save', { disabled: true, busy: false, label: 'Saving…' })).toBe(true)
    expect(showsPending('Log in', { disabled: false, busy: true, label: 'Logging in…' })).toBe(true)
  })

  test('a disabled button that says the same word is told by its colour alone: not pending', () => {
    expect(showsPending('Log in', { disabled: true, busy: false, label: 'Log in' })).toBe(false)
  })

  test('a new word on a button that still takes taps is not pending either', () => {
    expect(showsPending('Save', { disabled: false, busy: false, label: 'Saving…' })).toBe(false)
  })
})

describe('PENDING_TAPS', () => {
  test('are the three primary actions the PRD names, each on a name a Violation may carry', () => {
    expect(PENDING_TAPS.map((tap) => tap.button)).toEqual(['Save sale', 'Save', 'Log in'])
    for (const tap of PENDING_TAPS) expect(SCREEN_NAMES.has(tap.screen)).toBe(true)
  })
})
