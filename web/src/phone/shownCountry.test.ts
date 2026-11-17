import { describe, expect, it } from 'vitest'
import cases from './plusCases.json'
import { shownCountry } from './shownCountry.ts'
import { SERVED } from './served.fixture.ts'
import { countryChoice, NO_CHOICE, OTHER_CHOICE, type PhoneCountryChoice } from './types.ts'

interface Case {
  text: string
  locked: boolean
  country?: string | null
}

function shownIso(choice: PhoneCountryChoice): string | null {
  return choice.kind === 'country' ? choice.code : null
}

describe('shownCountry', () => {
  it.each(cases as Case[])('reads "$text" as the server does', ({ text, locked, country }) => {
    const picked = countryChoice('AR')
    const shown = shownCountry(text, picked, SERVED)

    expect(shown.locked).toBe(locked)
    if (locked) expect(shownIso(shown.choice)).toBe(country)
    else expect(shown.choice).toBe(picked)
  })

  it('locks on a listed code, whatever was picked', () => {
    expect(shownCountry('+598 99 123 456', countryChoice('AR'), SERVED)).toEqual({
      choice: countryChoice('UY'),
      locked: true,
    })
  })

  it('locks on Other for an unlisted or an incomplete code', () => {
    expect(shownCountry('+999 1', countryChoice('AR'), SERVED)).toEqual({ choice: OTHER_CHOICE, locked: true })
    expect(shownCountry('+59', countryChoice('AR'), SERVED)).toEqual({ choice: OTHER_CHOICE, locked: true })
  })

  it('returns what was picked, unlocked, without a "+"', () => {
    expect(shownCountry('099 123 456', NO_CHOICE, SERVED)).toEqual({ choice: NO_CHOICE, locked: false })
  })

  it('reads no code at all while the served list is empty', () => {
    expect(shownCountry('+598', NO_CHOICE, [])).toEqual({ choice: OTHER_CHOICE, locked: true })
  })
})
