/**
 * The refusal codes and the key of each, the one place that reads `api/contract.json` for the
 * code list. `api/refusals.ts` re-exports `REFUSAL_KEY` from here, so its readers do not change.
 */

import contract from '../api/contract.json' with { type: 'json' }
import type { RefusalCode } from '../api/refusals.ts'
import refusalKeys from '../copy/refusalKeys.json' with { type: 'json' }
import { refusals } from './englishStatic.ts'
import { buildRefusalKeys, type RefusalKey } from './refusalKeys.ts'

/** `code` is one of the codes `contract.json` lists (an own key, not `toString`). */
export function isRefusalCode(code: string): code is RefusalCode {
  return Object.hasOwn(contract.refusalCodes, code)
}

/** Every code the backend can answer with, as `contract.json` lists them. */
export const REFUSAL_CODES: readonly RefusalCode[] = Object.keys(contract.refusalCodes).filter(
  isRefusalCode,
)

/** The key of every code in `copy/refusalKeys.json`, the one hand-kept code-to-key table:
 * built at import, so a code with no key, or a key `locales/en/refusals.json` lacks, stops the
 * app at load instead of showing the wrong words. */
export const REFUSAL_KEY: Record<RefusalCode, RefusalKey> = buildRefusalKeys(
  refusalKeys,
  refusals,
  REFUSAL_CODES,
)
