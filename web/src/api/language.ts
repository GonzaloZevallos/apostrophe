/**
 * The business's languages as the API gives them (invariant 8): the **shown** language is what
 * decides which texts to show (`/auth/me`), the **stored** one is what the control reads and
 * edits (`GET /business`). They are distinct branded types, so one cannot stand in for the other
 * and `tsc` says so. A `LanguageTag` is a plain tag, as in the selectable list.
 */

declare const shownBrand: unique symbol
declare const storedBrand: unique symbol

export type LanguageTag = string
export type ShownLanguage = string & { readonly [shownBrand]: true }
export type StoredLanguage = string & { readonly [storedBrand]: true }

/** The one comparison between a stored language and a tag, by value. */
export function sameLanguage(stored: StoredLanguage, tag: LanguageTag): boolean {
  return stored === tag
}
