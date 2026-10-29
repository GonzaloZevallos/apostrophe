/**
 * The wordings a screen must never show while its data loads (no false empty state). They are
 * the screens' own keys (`copy/emptyStates.ts`'s `EMPTY_STATE_KEYS`) resolved from the bundles
 * the caller passes, never copied: a new empty state is added there once and is forbidden here
 * without another edit. This module reads no file: `e2e/` loads the bundles from disk.
 */

import { EMPTY_STATE_KEYS } from '../copy/emptyStates.ts'
import { resolveKey, type Bundle } from '../i18n/resolve.ts'

const wordingsOf = (bundle: Bundle, tag: string): string[] =>
  Object.values(EMPTY_STATE_KEYS).map((key) => resolveKey(bundle, key, undefined, tag))

/**
 * The eleven English wordings for every run, plus the run's own eleven when its `tag` is not
 * `en` (a screen that has not switched yet still shows English).
 */
export function forbiddenWhileLoading(english: Bundle, run: Bundle, tag: string): readonly string[] {
  return tag === 'en' ? wordingsOf(english, 'en') : [...wordingsOf(english, 'en'), ...wordingsOf(run, tag)]
}
