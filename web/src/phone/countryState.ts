/**
 * The Phone country of the customer form as a reducer (docs/adr/20261111-phone-country-per-number). The choice is what the
 * Selector shows; it follows the "+" while the text has one, so deleting the "+" keeps the last
 * shown country; detection fills it once, only when nothing was picked and there is no "+".
 */

import { plusDigits, shownCountry } from './shownCountry.ts'
import {
  countryChoice,
  NO_CHOICE,
  OTHER_CHOICE,
  type ListedCountry,
  type PhoneCountryChoice,
} from './types.ts'

/** The Selector's id for Other; it becomes null only in `toRequestCountry`. */
export const OTHER_ID = 'other'

export interface CountryState {
  readonly text: string
  readonly choice: PhoneCountryChoice
  /** Whether detection has run (or no longer applies); it never runs twice. */
  readonly detectionDone: boolean
}

export const INITIAL_COUNTRY_STATE: CountryState = { text: '', choice: NO_CHOICE, detectionDone: false }

export type CountryAction =
  | { readonly type: 'typed'; readonly text: string; readonly listed: readonly ListedCountry[] }
  | { readonly type: 'picked'; readonly choice: PhoneCountryChoice }
  | {
      readonly type: 'listResolved'
      readonly detected: string | null
      readonly listed: readonly ListedCountry[]
    }
  | { readonly type: 'opened'; readonly storedPhone: string | null; readonly listed: readonly ListedCountry[] }

function hasPlus(text: string): boolean {
  return plusDigits(text) !== null
}

export function countryReducer(state: CountryState, action: CountryAction): CountryState {
  switch (action.type) {
    case 'typed': {
      const shown = shownCountry(action.text, state.choice, action.listed)
      return { ...state, text: action.text, choice: shown.locked ? shown.choice : state.choice }
    }
    case 'picked':
      return hasPlus(state.text) ? state : { ...state, choice: action.choice }
    case 'listResolved': {
      if (state.detectionDone) return state
      if (hasPlus(state.text)) {
        // A "+" typed before the list arrived was read against no codes: read it again.
        return { ...state, choice: shownCountry(state.text, state.choice, action.listed).choice, detectionDone: true }
      }
      if (state.choice.kind !== 'none') return { ...state, detectionDone: true }
      const choice = action.detected === null ? OTHER_CHOICE : countryChoice(action.detected)
      return { ...state, choice, detectionDone: true }
    }
    case 'opened': {
      if (action.storedPhone === null) return { text: '', choice: NO_CHOICE, detectionDone: false }
      const shown = shownCountry(action.storedPhone, NO_CHOICE, action.listed)
      return { text: action.storedPhone, choice: shown.choice, detectionDone: true }
    }
  }
}

/** The Selector's option id of a choice; null while nothing is chosen. */
export function choiceId(choice: PhoneCountryChoice): string | null {
  switch (choice.kind) {
    case 'none':
      return null
    case 'other':
      return OTHER_ID
    case 'country':
      return choice.code
  }
}

export function choiceOfId(id: string): PhoneCountryChoice {
  return id === OTHER_ID ? OTHER_CHOICE : countryChoice(id)
}

/** The country the request sends: the shown code, or null for Other. The only place Other becomes null. */
export function toRequestCountry(choice: PhoneCountryChoice): string | null {
  return choice.kind === 'country' ? choice.code : null
}
