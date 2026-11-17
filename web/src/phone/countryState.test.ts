import { describe, expect, it } from 'vitest'
import {
  choiceId,
  choiceOfId,
  countryReducer,
  INITIAL_COUNTRY_STATE,
  OTHER_ID,
  toRequestCountry,
  type CountryAction,
  type CountryState,
} from './countryState.ts'
import { SERVED } from './served.fixture.ts'
import { countryChoice, NO_CHOICE, OTHER_CHOICE } from './types.ts'

function run(...actions: CountryAction[]): CountryState {
  return actions.reduce(countryReducer, INITIAL_COUNTRY_STATE)
}
const typed = (text: string): CountryAction => ({ type: 'typed', text, listed: SERVED })
const resolved = (detected: string | null): CountryAction => ({ type: 'listResolved', detected, listed: SERVED })

describe('the Phone country reducer', () => {
  it('follows the "+" while typing and keeps the country when the "+" is deleted', () => {
    const state = run(resolved('AR'), typed('+598 99'), typed('598 99'))

    expect(state.choice).toEqual(countryChoice('UY'))
    expect(countryReducer(state, { type: 'picked', choice: countryChoice('AR') }).choice).toEqual(countryChoice('AR'))
  })

  it('ignores a pick while the text has a "+"', () => {
    const state = run(typed('+598 99'))

    expect(countryReducer(state, { type: 'picked', choice: countryChoice('AR') })).toBe(state)
  })

  it('fills the choice with the detected country once, when nothing was picked', () => {
    expect(run(resolved('UY')).choice).toEqual(countryChoice('UY'))
    expect(run(resolved(null)).choice).toEqual(OTHER_CHOICE)
  })

  it('does nothing when detection arrives late over a typed "+"', () => {
    const state = run(typed('+598 99'), resolved('AR'))

    expect(state.choice).toEqual(countryChoice('UY'))
    expect(state.detectionDone).toBe(true)
  })

  it('does not overwrite a pick, nor detect again after a list reload', () => {
    const picked = run({ type: 'picked', choice: countryChoice('CL') }, resolved('UY'))
    expect(picked.choice).toEqual(countryChoice('CL'))

    const reloaded = run(resolved('UY'), { type: 'picked', choice: OTHER_CHOICE }, resolved('AR'))
    expect(reloaded.choice).toEqual(OTHER_CHOICE)
  })

  it('reads a "+" typed before the list arrived once it does', () => {
    const early = countryReducer(INITIAL_COUNTRY_STATE, { type: 'typed', text: '+598 99', listed: [] })
    expect(early.choice).toEqual(OTHER_CHOICE)

    expect(countryReducer(early, resolved('AR')).choice).toEqual(countryChoice('UY'))
  })

  it('opens an Edit with a stored number on its own country, and one without as a new customer', () => {
    const stored = run({ type: 'opened', storedPhone: '+59899123456', listed: SERVED })
    expect(stored).toMatchObject({ choice: countryChoice('UY'), detectionDone: true })

    const unlisted = run({ type: 'opened', storedPhone: '+4915112345678', listed: SERVED })
    expect(unlisted.choice).toEqual(OTHER_CHOICE)

    const none = run({ type: 'opened', storedPhone: null, listed: SERVED }, resolved('UY'))
    expect(none.choice).toEqual(countryChoice('UY'))
  })
})

describe('the request country', () => {
  it('sends the shown code, and null only for Other (or nothing chosen)', () => {
    expect(toRequestCountry(countryChoice('UY'))).toBe('UY')
    expect(toRequestCountry(OTHER_CHOICE)).toBeNull()
    expect(toRequestCountry(NO_CHOICE)).toBeNull()
  })

  it('maps a choice to the Selector id and back, Other being "other"', () => {
    expect(OTHER_ID).toBe('other')
    expect(choiceId(OTHER_CHOICE)).toBe('other')
    expect(choiceId(NO_CHOICE)).toBeNull()
    expect(choiceId(countryChoice('UY'))).toBe('UY')
    expect(choiceOfId('other')).toEqual(OTHER_CHOICE)
    expect(choiceOfId('UY')).toEqual(countryChoice('UY'))
  })
})
