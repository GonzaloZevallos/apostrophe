/**
 * The limits on always-visible copy (docs/product/icon-and-text-rule.md) and the one
 * checker over the copy modules, run by `copyLimits.test.ts`.
 *
 * A limit is measured on the copy as shown, with every placeholder filled from
 * `SAMPLES` (the worst cases), never from fixture or API data.
 */

import { PLACEHOLDERS } from '../i18n/placeholders'
import { interpolate, MissingKeyError, placeholdersOf, selectText, type Args, type Bundle } from '../i18n/resolve'

/** The kinds of always-visible text with a limit, in characters. */
export const LIMITS = {
  help: 80,
  notice: 80,
  moreInfo: 80,
  emptyTitle: 40,
  emptyLine: 80,
} as const

export type CopyKind = keyof typeof LIMITS

/** Over this a refusal must be listed in its module's `LONG_REFUSALS`. */
export const REFUSAL_AIM = 80

/** What a placeholder is filled with when a function's copy is measured. */
export const SAMPLES = {
  date: '28/09',
  amount: '$ 999.999',
  negativeAmount: '−$ 999.999',
  grams: '999,99 g',
  name: 'Name of twenty-four char',
  count: '99',
} as const

/** Code points after NFC: `á` is one whether composed or not, an emoji is one. */
export function measure(text: string): number {
  return Array.from(text.normalize('NFC')).length
}

/** A text kept in a copy module: today's word, or a key into a locale namespace whose `args`
 * only choose a plural form or override a sample (every other placeholder is filled from
 * `SAMPLES` through `PLACEHOLDERS`). */
export type LimitedCopy =
  | { kind: CopyKind; text: string }
  | { kind: CopyKind; key: string; args?: Args }

/** What a copy module (a file of `web/src/copy/`) exports besides its strings. A keyed module
 * exports `NAMESPACE`, and its `LONG_REFUSALS` holds keys rather than texts. */
export interface CopyModule {
  NAMESPACE?: string
  LIMITED_COPY?: readonly LimitedCopy[]
  LONG_REFUSALS?: readonly string[]
  [name: string]: unknown
}

/** The real language folders by tag, each a bundle (namespace to content). */
export type Locales = Readonly<Record<string, Bundle>>

/** The forced pseudo-locale: generated, never a language, so never read by a check. */
const PSEUDO = 'en-XA'

/** `en` always (a key missing there is a problem), then every other real folder. */
function realTags(locales: Locales): string[] {
  return ['en', ...Object.keys(locales).filter((tag) => tag !== 'en' && tag !== PSEUDO).sort()]
}

type Rendered = { missing: true } | { problem: string } | { text: string }

/** A key as shown in `tag`, placeholders filled from `SAMPLES` (never from data); `args`
 * overrides. A name outside `PLACEHOLDERS` is a problem, whatever `args` holds. */
function render(locales: Locales, tag: string, key: string, args: Args | undefined): Rendered {
  const bundle = locales[tag] ?? {}
  try {
    const raw = selectText(bundle, key, args, tag)
    const fill: Record<string, string | number> = {}
    for (const name of placeholdersOf(raw)) {
      const kind = PLACEHOLDERS[name]
      if (kind === undefined) return { problem: `${key} (${tag}) holds the placeholder ${name}, which is not in PLACEHOLDERS` }
      fill[name] = SAMPLES[kind]
    }
    return { text: interpolate(key, raw, { ...fill, ...args }) }
  } catch (error) {
    if (error instanceof MissingKeyError) return { missing: true }
    return { problem: `${key} (${tag}) cannot be resolved: ${error instanceof Error ? error.message : 'unknown error'}` }
  }
}

interface Leaf {
  key: string
  base: string
  text: string
}

const PLURAL_FORM = /_(zero|one|two|few|many|other)$/

/** Every text of a namespace in one language; `base` is the key without a plural suffix. */
function leavesOf(locales: Locales, tag: string, ns: string): Leaf[] {
  const out: Leaf[] = []
  const walk = (value: unknown, key: string): void => {
    if (typeof value === 'string') out.push({ key, base: key.replace(PLURAL_FORM, ''), text: value })
    else if (typeof value === 'object' && value !== null) {
      for (const [name, item] of Object.entries(value)) walk(item, `${key}${key.endsWith(':') ? '' : '.'}${name}`)
    }
  }
  walk(locales[tag]?.[ns], `${ns}:`)
  return out
}

/** The text of a leaf as shown, placeholders filled from `SAMPLES`; a problem if one is unregistered. */
function leafText(tag: string, leaf: Leaf): Rendered {
  const fill: Record<string, string> = {}
  for (const name of placeholdersOf(leaf.text)) {
    const kind = PLACEHOLDERS[name]
    if (kind === undefined) return { problem: `${leaf.key} (${tag}) holds the placeholder ${name}, which is not in PLACEHOLDERS` }
    fill[name] = SAMPLES[kind]
  }
  return { text: interpolate(leaf.key, leaf.text, fill) }
}

function keyedProblems(path: string, mod: CopyModule, locales: Locales, namespace: string): string[] {
  const problems: string[] = []
  const inside = (key: string): boolean => key.startsWith(`${namespace}:`)
  const tags = realTags(locales)

  for (const entry of mod.LIMITED_COPY ?? []) {
    if (!('key' in entry)) continue
    if (!inside(entry.key)) {
      problems.push(`${path}: ${entry.key} is outside the namespace ${namespace}`)
      continue
    }
    for (const tag of tags) {
      const shown = render(locales, tag, entry.key, entry.args)
      if ('problem' in shown) problems.push(`${path}: ${shown.problem}`)
      else if ('missing' in shown) {
        if (tag === 'en') {
          problems.push(`${path}: ${entry.key} is absent from en`)
          break
        }
      } else if (measure(shown.text) > LIMITS[entry.kind]) {
        problems.push(`${path}: ${entry.key} (${tag}) is a ${entry.kind} over ${LIMITS[entry.kind]} characters`)
      }
    }
  }

  const listed = new Set(mod.LONG_REFUSALS ?? [])
  const over = new Set<string>()
  for (const tag of tags) {
    for (const leaf of leavesOf(locales, tag, namespace)) {
      const shown = leafText(tag, leaf)
      if ('problem' in shown) problems.push(`${path}: ${shown.problem}`)
      else if ('text' in shown && measure(shown.text) > REFUSAL_AIM) {
        over.add(leaf.key)
        over.add(leaf.base)
        if (!listed.has(leaf.key) && !listed.has(leaf.base)) {
          problems.push(`${path}: ${leaf.key} (${tag}) is over ${REFUSAL_AIM} characters and not in LONG_REFUSALS`)
        }
      }
    }
  }
  const held = new Set(leavesOf(locales, 'en', namespace).flatMap((leaf) => [leaf.key, leaf.base]))
  for (const key of listed) {
    if (!inside(key)) problems.push(`${path}: LONG_REFUSALS lists ${key}, outside the namespace ${namespace}`)
    else if (!held.has(key)) problems.push(`${path}: LONG_REFUSALS lists ${key}, which en does not hold`)
    else if (!over.has(key)) problems.push(`${path}: LONG_REFUSALS lists ${key}, which fits ${REFUSAL_AIM}`)
  }
  return problems
}

/** The violations of one copy module, each a sentence naming the module and the rule
 * (never the text's data). Empty when the module is sound. A keyed module (one exporting
 * `NAMESPACE`) is resolved in `en` and in every real language of `locales` (`en-XA`
 * excluded by name): a key missing in `en` is a problem, one missing in another language
 * is skipped (ADR-0050). */
export function copyProblems(path: string, mod: CopyModule, locales: Locales): string[] {
  const problems: string[] = []
  const { LIMITED_COPY, LONG_REFUSALS, NAMESPACE } = mod
  if (LIMITED_COPY === undefined) problems.push(`${path}: LIMITED_COPY is not exported`)
  if (LONG_REFUSALS === undefined) problems.push(`${path}: LONG_REFUSALS is not exported`)
  if (LIMITED_COPY === undefined || LONG_REFUSALS === undefined) return problems

  for (const entry of LIMITED_COPY) {
    if ('key' in entry) continue
    if (measure(entry.text) > LIMITS[entry.kind]) {
      problems.push(`${path}: a ${entry.kind} is over ${LIMITS[entry.kind]} characters`)
    }
  }

  if (typeof NAMESPACE === 'string') return [...new Set([...problems, ...keyedProblems(path, mod, locales, NAMESPACE)])]
  if (LIMITED_COPY.some((entry) => 'key' in entry)) problems.push(`${path}: NAMESPACE is not exported`)

  const exported = Object.entries(mod).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === 'string' && entry[0] !== 'LIMITED_COPY' && entry[0] !== 'LONG_REFUSALS',
  )
  const listed = new Set(LONG_REFUSALS)
  for (const [name, text] of exported) {
    if (measure(text) > REFUSAL_AIM && !listed.has(text)) {
      problems.push(`${path}: ${name} is over ${REFUSAL_AIM} characters and not in LONG_REFUSALS`)
    }
  }
  const values = new Set(exported.map(([, text]) => text))
  for (const text of LONG_REFUSALS) {
    if (!values.has(text)) problems.push(`${path}: LONG_REFUSALS lists a text the module does not export`)
    else if (measure(text) <= REFUSAL_AIM) problems.push(`${path}: LONG_REFUSALS lists a text that fits ${REFUSAL_AIM}`)
  }
  return problems
}
