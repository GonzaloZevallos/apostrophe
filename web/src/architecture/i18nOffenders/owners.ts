/**
 * Who removes the words of each copy file (GH-379, ADR-0049): the area part of the i18n front
 * that moves them to keys. This table is the only place an issue number is written for a copy
 * file; the offender lists (`copyExportsText.json`, `copyImports.json`) read it, never repeat it.
 * `lists.test.ts` holds it total over `web/src/copy/*.ts` (minus `limits.ts` and `baselineArgs.ts`).
 */

export type Owner = 350 | 351 | 352 | 353 | 'none'

export const COPY_OWNER: Record<string, Owner> = {
  'auth.ts': 350,
  'onboarding.ts': 350,
  'shell.ts': 350,
  'inicio.ts': 350,
  'sales.ts': 351,
  'payments.ts': 351,
  'customers.ts': 351,
  'expenses.ts': 351,
  'varieties.ts': 352,
  'stock.ts': 352,
  'catalog.ts': 352,
  'pinnedCatalog.ts': 352,
  'settings.ts': 353,
  'paymentMethods.ts': 353,
  'analysis.ts': 353,
  'dates.ts': 353,
  'emptyStates.ts': 'none',
  'common.ts': 'none',
}

/** Why a file has no owner: it needs no part to move its words. */
export const NO_OWNER_REASON: Record<string, string> = {
  'emptyStates.ts': 'it exports only keys',
  'common.ts': 'its @deprecated texts object and its two messages are held equal to their keys by common.deprecated.test.ts',
}

/**
 * The exports whose plain strings are not text, by copy file: the strings of `EMPTY_STATE_LIMITS`
 * are limit kinds (`emptyLine`). Any other export of the file still counts, so a real word added
 * to `emptyStates.ts` is an offender.
 */
export const NOT_TEXT_EXPORTS: Record<string, readonly string[]> = {
  'emptyStates.ts': ['EMPTY_STATE_LIMITS'],
}

/** What is wrong with an owner table over the copy `files`: a file with no owner, one that is gone, a `none` with no reason. */
export function ownerProblems(owner: Record<string, Owner>, reasons: Record<string, string>, files: readonly string[]): string[] {
  const named = Object.keys(owner)
  return [
    ...files.filter((file) => !named.includes(file)).map((file) => `no owner: ${file}`),
    ...named.filter((file) => !files.includes(file)).map((file) => `gone: ${file}`),
    ...named.filter((file) => owner[file] === 'none' && (reasons[file] ?? '').trim() === '').map((file) => `no reason for none: ${file}`),
    ...named.filter((file) => owner[file] !== 'none' && file in reasons).map((file) => `reason for a file that has an owner: ${file}`),
  ]
}
