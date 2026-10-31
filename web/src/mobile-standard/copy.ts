/**
 * The English words the walk reads from the shared `common` namespace, resolved once at
 * load from the bundle with the pure resolver. The walk runs in English against the pinned
 * fixture (ADR-0048), so no language is chosen here and the i18next instance is never
 * imported: this file stays in the browserless core the Playwright spec loads.
 */

import enCommon from '../copy/locales/en/common.json' with { type: 'json' }
import enRefusals from '../copy/locales/en/refusals.json' with { type: 'json' }
import enTimeZone from '../copy/locales/en/timeZone.json' with { type: 'json' }
import type { Refusal } from '../i18n/refusalKeys.ts'
import { type Args, resolveKey } from '../i18n/resolve.ts'
import type { CopyKey } from '../i18n/resources.generated.ts'

type CommonKey = Extract<CopyKey, `common:${string}`>
type TimeZoneKey = Extract<CopyKey, `timeZone:${string}`>

const BUNDLE = { common: enCommon, refusals: enRefusals, timeZone: enTimeZone }

/** The English text of a `common:` key, `{{name}}` filled from `args`. */
export function common(key: CommonKey, args?: Args): string {
  return resolveKey(BUNDLE, key, args)
}

/** The English text of a refusal. */
export function refusal(refused: Refusal): string {
  return resolveKey(BUNDLE, refused.key)
}

/** The English text of a `timeZone:` key (the Time zone sheet's own words), `{{name}}` filled from `args`. */
export function timeZone(key: TimeZoneKey, args?: Args): string {
  return resolveKey(BUNDLE, key, args)
}
