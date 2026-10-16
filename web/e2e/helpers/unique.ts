/**
 * A tag that makes a business name or an email unique to one call, for the e2e specs
 * (ADR-0043, amendment web-wall-clock). It comes from `crypto.randomUUID`, never from the
 * clock: no e2e file reads the wall clock, and two calls in the same millisecond, or on
 * two workers, still differ.
 */

/** Twelve hex characters: short enough for a name or an email's local part. */
export function uniqueTag(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 12)
}
