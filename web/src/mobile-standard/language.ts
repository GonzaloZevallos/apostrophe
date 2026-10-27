/**
 * The page's language against the run's. A mismatch is a reason of its own that fails the
 * walk step: it is not a `Rule` of `violation.ts`, so no offender list can absorb it, and it
 * is never a pass or a skip.
 */

/** `null` when the page is in the run's locale, else the reason the step fails with. */
export function judgeLanguage(pageLang: string, runLocale: string): string | null {
  return pageLang === runLocale ? null : `page lang ${pageLang}, run locale ${runLocale}`
}
