/**
 * What the phone modules need of a listed country, a subset of what `GET /phone-countries`
 * serves: its ISO code and the digits of its calling code, without the "+". The front holds
 * no calling code of its own; every one comes from the served list.
 */
export interface ListedCountry {
  readonly code: string
  readonly calling_code: string
}

/** The Phone country of a number being typed: nothing chosen yet, Other, or one listed country. */
export type PhoneCountryChoice =
  | { readonly kind: 'none' }
  | { readonly kind: 'other' }
  | { readonly kind: 'country'; readonly code: string }

export const NO_CHOICE: PhoneCountryChoice = { kind: 'none' }
export const OTHER_CHOICE: PhoneCountryChoice = { kind: 'other' }

export function countryChoice(code: string): PhoneCountryChoice {
  return { kind: 'country', code }
}
