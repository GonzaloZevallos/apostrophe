/**
 * The two refusals of a chosen logo file (`refusals:logoTooBig`, `refusals:logoWrongType`),
 * registered by key so `copyLimits.test.ts` measures them.
 */

import type { KeyedCopy } from './limits.ts'

export const LANGUAGE: 'es' | 'en' = 'en'
export const NAMESPACE = 'refusals'

export const LIMITED_COPY: readonly KeyedCopy[] = [
  { kind: 'notice', key: 'refusals:logoTooBig' },
  { kind: 'notice', key: 'refusals:logoWrongType' },
]
export const LONG_REFUSALS: readonly string[] = []
