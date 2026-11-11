/**
 * The only module that reads where the app is being used: the device's language list and its
 * time zone. Both are read at the moment of the call, kept nowhere, sent nowhere
 * (docs/adr/0085). `detectCountry` takes what these return.
 */

export function deviceLanguages(): readonly string[] {
  if (navigator.languages.length > 0) return navigator.languages
  return navigator.language === '' ? [] : [navigator.language]
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return ''
  }
}
