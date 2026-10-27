/**
 * The permanent proof that English refusals are unchanged: `baselineKeys/refusals.json` walked
 * against `en.baseline.json` and `locales/en/refusals.json`. It reads the baseline, never the
 * copy module, so it outlives `copy/refusals.ts`. Problems name a source or a leaf, never a text.
 *
 * - a `refusals.ts:*` baseline source with no mapping (`LANGUAGE` is the locale tag, not a text);
 * - a leaf of `refusals.json` that no mapping points at;
 * - a mapped row whose `en` text is not byte-equal to its baseline text.
 */

import { resolveKey, type Bundle } from '../../src/i18n/resolve.ts'
import type { Entry } from './baseline.ts'
import type { Mappings } from './baselineKeys.ts'

const SOURCE_PREFIX = 'refusals.ts:'
const LOCALE_TAG_SOURCE = 'refusals.ts:LANGUAGE'
const KEY_PREFIX = 'refusals:'

export function refusalWalkProblems(committed: readonly Entry[], mappings: Mappings, en: Bundle): string[] {
  const problems: string[] = []
  const sources = new Set(
    committed.filter((entry) => entry.source.startsWith(SOURCE_PREFIX) && entry.source !== LOCALE_TAG_SOURCE).map((entry) => entry.source),
  )
  for (const source of sources) {
    if (!Object.hasOwn(mappings, source)) problems.push(`${source}: not mapped`)
  }
  const used = new Set(Object.values(mappings).map(({ key }) => key))
  const bundle = en['refusals']
  const leaves = typeof bundle === 'object' && bundle !== null ? Object.keys(bundle) : []
  for (const leaf of leaves) {
    if (!used.has(`${KEY_PREFIX}${leaf}`)) problems.push(`${KEY_PREFIX}${leaf}: no source uses it`)
  }
  for (const entry of committed) {
    const mapping = Object.hasOwn(mappings, entry.source) ? mappings[entry.source] : undefined
    if (mapping === undefined) continue
    try {
      if (resolveKey(en, mapping.key) !== entry.text) problems.push(`${entry.source}: not byte-equal to its baseline text`)
    } catch {
      problems.push(`${entry.source}: ${mapping.key} cannot be resolved`)
    }
  }
  return problems.sort()
}
