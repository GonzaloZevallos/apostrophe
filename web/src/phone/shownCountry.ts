/**
 * The country a Phone field's text and the Selector show together. A text that starts with "+"
 * sets the country by its calling code (a listed code gives that country, an unlisted or
 * incomplete one gives Other) and locks the Selector; any other text leaves what was picked.
 * The "+" is read as `PhoneNumber.plus_digits` reads it on the server (`plusCases.json`).
 */

import { countryChoice, OTHER_CHOICE, type ListedCountry, type PhoneCountryChoice } from './types.ts'

const SEPARATORS = /[ \-.()]/g

/** What follows a leading "+" once the separators are removed, or null when the text has no "+" form. */
export function plusDigits(text: string): string | null {
  const cleaned = text.replace(SEPARATORS, '')
  return cleaned.startsWith('+') ? cleaned.slice(1) : null
}

export interface ShownCountry {
  readonly choice: PhoneCountryChoice
  readonly locked: boolean
}

export function shownCountry(
  text: string,
  picked: PhoneCountryChoice,
  listed: readonly ListedCountry[],
): ShownCountry {
  const digits = plusDigits(text)
  if (digits === null) return { choice: picked, locked: false }
  const match = digits === '' ? undefined : listed.find((country) => digits.startsWith(country.calling_code))
  return { choice: match === undefined ? OTHER_CHOICE : countryChoice(match.code), locked: true }
}
