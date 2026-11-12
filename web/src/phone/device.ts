/**
 * The only module that reads where the app is being used: the device's language list and its
 * time zone. Both are read at the moment of the call, kept nowhere, sent nowhere
 * (docs/adr/20261111-phone-country-per-number). `detectCountry` takes what these return.
 */

export function deviceLanguages(): readonly string[] {
  if (navigator.languages.length > 0) return navigator.languages
  return navigator.language === '' ? [] : [navigator.language]
}

interface TemporalNow {
  readonly Now: { timeZoneId(): string }
}

/**
 * The IANA zone of the device, or '' when the browser cannot say. It is read with
 * `Temporal.Now.timeZoneId()` because the locale ban (ADR-0049) forbids the date formatter
 * that the older route (`resolvedOptions().timeZone`) goes through; a browser without
 * Temporal answers '' and detection falls back to the language alone.
 */
export function deviceTimeZone(): string {
  const temporal = (globalThis as { Temporal?: TemporalNow }).Temporal
  try {
    return temporal?.Now.timeZoneId() ?? ''
  } catch {
    return ''
  }
}
