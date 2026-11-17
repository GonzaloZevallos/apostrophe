/**
 * The English words the walk reads from the shared `common` namespace, resolved once at
 * load from the bundle with the pure resolver. The walk runs in English against the pinned
 * fixture (ADR-0048), so no language is chosen here and the i18next instance is never
 * imported: this file stays in the browserless core the Playwright spec loads.
 */

import { ENGLISH_STATIC } from '../i18n/englishStatic.ts'
import type { Refusal } from '../i18n/refusalKeys.ts'
import { type Args, resolveKey } from '../i18n/resolve.ts'
import type { CopyKey } from '../i18n/resources.generated.ts'

type CommonKey = Extract<CopyKey, `common:${string}`>

/** The English text of a `common:` key, `{{name}}` filled from `args`. */
export function common(key: CommonKey, args?: Args): string {
  return resolveKey(ENGLISH_STATIC, key, args)
}

type EmptyStatesKey = Extract<CopyKey, `emptyStates:${string}`>

/** The English text of an `emptyStates:` key. */
export function emptyState(key: EmptyStatesKey): string {
  return resolveKey(ENGLISH_STATIC, key)
}

/** The English text of a refusal. */
export function refusal(refused: Refusal): string {
  return resolveKey(ENGLISH_STATIC, refused.key)
}
