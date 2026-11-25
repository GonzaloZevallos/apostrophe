/**
 * The wordings a screen must never show while its data loads (no false empty state). They are
 * the screens' own keys (`copy/emptyStates.ts`'s `EMPTY_STATE_KEYS`) resolved from the bundles
 * the caller passes, never copied: a new empty state is added there once and is forbidden here
 * without another edit. This module reads no file: `e2e/` loads the bundles from disk.
 */

import { EMPTY_STATE_KEYS } from '../copy/emptyStates.ts'
import { placeholdersOf, resolveKey, selectText, type Bundle } from '../i18n/resolve.ts'

/**
 * What a key forbids: its whole text, or, for a key with a `{{placeholder}}`, the fixed part of
 * the bundle's own raw template before the first one (a rendered line would carry a query nobody
 * can know here). A template that opens with a placeholder has no fixed part: it is refused.
 */
function forbiddenOf(bundle: Bundle, key: string, tag: string): string {
  const raw = selectText(bundle, key, undefined, tag)
  if (placeholdersOf(raw).length === 0) return resolveKey(bundle, key, undefined, tag)
  const fixed = raw.slice(0, raw.indexOf('{{'))
  if (fixed === '') throw new Error(`${key}: a placeholder opens the text, so there is no fixed part to forbid`)
  return fixed
}

const wordingsOf = (bundle: Bundle, tag: string): string[] =>
  Object.values(EMPTY_STATE_KEYS).map((key) => forbiddenOf(bundle, key, tag))

/**
 * The English wordings for every run, plus the run's own when its `tag` is not
 * `en` (a screen that has not switched yet still shows English).
 */
export function forbiddenWhileLoading(english: Bundle, run: Bundle, tag: string): readonly string[] {
  return tag === 'en' ? wordingsOf(english, 'en') : [...wordingsOf(english, 'en'), ...wordingsOf(run, tag)]
}
