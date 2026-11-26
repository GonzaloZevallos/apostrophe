/**
 * The two refusals of a chosen logo file, by `logoRefusal`'s answer. The texts are the ones
 * of `refusals:logoTooBig` and `refusals:logoWrongType` (a Vitest check holds them to
 * `locales/en`); the keys are registered here so `copyLimits.test.ts` measures them.
 */

import type { KeyedCopy } from './limits.ts'

export const NAMESPACE = 'refusals'

/** The exports below that are moved to keys: the English baseline records them under their keys. */
export const MOVED_TO_KEYS = ['LOGO_REFUSAL_TEXT'] as const

/** @deprecated read `refusals:logoTooBig` and `refusals:logoWrongType` */
export const LOGO_REFUSAL_TEXT = {
  too_big: 'Use an image of 1 MB or less.',
  wrong_type: 'Use a PNG or JPEG.',
} as const

export const LIMITED_COPY: readonly KeyedCopy[] = [
  { kind: 'notice', key: 'refusals:logoTooBig' },
  { kind: 'notice', key: 'refusals:logoWrongType' },
]
export const LONG_REFUSALS: readonly string[] = []
