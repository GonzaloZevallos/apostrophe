/**
 * The Phone country of a customer form (docs/adr/20261111-phone-country-per-number): the list the API serves, the
 * `countryState` reducer that holds the choice, and the one-time detection from the device.
 * The form owns the phone text; this hook sees it through `type` and decides what the Selector
 * shows, whether it is locked and which code the request sends. Nothing here is stored or
 * remembered between forms.
 */

import { useReducer } from 'react'
import { usePhoneCountries, type PhoneCountryListing } from '../../api/phoneCountries'
import { detectCountry } from '../../phone/detectCountry'
import { countryReducer, INITIAL_COUNTRY_STATE, toRequestCountry, type CountryState } from '../../phone/countryState'
import { deviceLanguages, deviceTimeZone } from '../../phone/device'
import { shownCountry } from '../../phone/shownCountry'
import type { PhoneCountryChoice } from '../../phone/types'

export interface PhoneCountryField {
  /** The served list; undefined while it is pending or after a failure. */
  countries: readonly PhoneCountryListing[] | undefined
  /** The list failed to load (the Selector stays `loading` and Save stays off). */
  failure: Error | null
  /** What the Selector shows, and whether a "+" in the text decided it. */
  choice: PhoneCountryChoice
  locked: boolean
  /** The list is in and the country is settled: Save may go. */
  ready: boolean
  /** The text of the Phone field changed. */
  type: (text: string) => void
  pick: (choice: PhoneCountryChoice) => void
  /** The code the request sends: the shown country, or null for Other. */
  requestCountry: string | null
}

function initialState(storedPhone: string | null): CountryState {
  return storedPhone === null || storedPhone === ''
    ? INITIAL_COUNTRY_STATE
    : { ...INITIAL_COUNTRY_STATE, text: storedPhone }
}

/** `storedPhone` is the number the form opens with (Edit); null for a new customer or one without a number. */
export function usePhoneCountryField(storedPhone: string | null): PhoneCountryField {
  const query = usePhoneCountries()
  const countries = query.data
  const [state, dispatch] = useReducer(countryReducer, storedPhone, initialState)

  // Detection runs once, when the list resolves, and only fills a choice nobody made. Adjusted
  // while rendering so no frame shows an empty Selector next to a loaded list.
  if (countries !== undefined && !state.detectionDone) {
    dispatch({
      type: 'listResolved',
      detected: detectCountry(deviceLanguages(), deviceTimeZone(), countries),
      listed: countries,
    })
  }

  const shown = shownCountry(state.text, state.choice, countries ?? [])
  return {
    countries,
    failure: query.isError ? query.error : null,
    choice: shown.choice,
    locked: shown.locked,
    ready: countries !== undefined && state.detectionDone,
    type: (text) => dispatch({ type: 'typed', text, listed: countries ?? [] }),
    pick: (choice) => dispatch({ type: 'picked', choice }),
    requestCountry: toRequestCountry(shown.choice),
  }
}
