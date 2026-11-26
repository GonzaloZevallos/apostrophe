/**
 * The Logo row's always-visible lines in the `settings` namespace, registered by key so
 * `copyLimits.test.ts` measures them. `{{business}}` is filled from `SAMPLES.name` through
 * `PLACEHOLDERS`. `settings.ts` cannot hold keyed entries: its `LIMITED_COPY` is read as plain texts.
 */

import type { KeyedCopy } from './limits.ts'

export const NAMESPACE = 'settings'

export const LIMITED_COPY: readonly KeyedCopy[] = [
  { kind: 'help', key: 'settings:logo.imageName' },
  { kind: 'help', key: 'settings:logo.saveFailed' },
]
export const LONG_REFUSALS: readonly string[] = []
