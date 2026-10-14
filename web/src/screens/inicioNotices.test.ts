import { describe, expect, test } from 'vitest'
import type { OnboardingProgress } from '../api/onboarding'
import { inicioNotices } from './inicioNotices'

function progress(overrides: Partial<OnboardingProgress>): OnboardingProgress {
  return {
    offered: true,
    over: false,
    count: 1,
    resume: 'stock',
    steps: [],
    can_skip_rest: false,
    varieties_count: 1,
    stock_entries_count: 0,
    price_target: null,
    stock_target: null,
    ...overrides,
  }
}

const ONBOARDING = progress({})

describe('inicioNotices', () => {
  test.each([
    ['onboarding answer not yet arrived: slot 1 empty, even with no priced variety', undefined, false, null],
    ['offered and not over: the Onboarding notice, whatever the prices say', ONBOARDING, false, 'onboarding'],
    ['offered and not over, priced today: still the Onboarding notice', ONBOARDING, true, 'onboarding'],
    ['finish state is still the Onboarding notice', progress({ resume: 'finish', count: 6 }), true, 'onboarding'],
    ['over and nothing priced today: Arrancá por las variedades', progress({ over: true, resume: null }), false, 'start'],
    ['never offered and nothing priced today: Arrancá por las variedades', progress({ offered: false, resume: null }), false, 'start'],
    ['never offered, priced today: nothing', progress({ offered: false, resume: null }), true, null],
    ['never offered, varieties not yet arrived: nothing', progress({ offered: false, resume: null }), undefined, null],
  ] as const)('%s', (_name, onboarding, pricedToday, expected) => {
    const slot = inicioNotices({ onboarding, pricedToday, pinOutOfDate: false }).first

    expect(slot?.kind ?? null).toBe(expected)
  })

  test('the pin notice is slot 2 and never replaces slot 1', () => {
    const notices = inicioNotices({ onboarding: ONBOARDING, pricedToday: true, pinOutOfDate: true })

    expect(notices.first?.kind).toBe('onboarding')
    expect(notices.pinOutOfDate).toBe(true)
  })
})
