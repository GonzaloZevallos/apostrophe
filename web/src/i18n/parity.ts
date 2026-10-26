import i18next from 'i18next'
import { SAMPLES } from '../copy/limits.ts'
import { productionOptions } from './options.ts'
import { PLACEHOLDERS } from './placeholders.ts'
import type { LocaleBundle } from './resources.ts'
import { placeholdersOf, resolveKey, type Args, type Bundle } from './resolve.ts'

/**
 * The parity reference for the resolver tests: a fresh instance initialised with the
 * production options and the bundle, never the app singleton and never with `saveMissing`.
 */

export interface ParityCase {
  key: string
  args: Record<string, string | number>
}

const PLURAL = /^(.*)_(zero|one|two|few|many|other)$/

interface Group {
  texts: string[]
  plural: boolean
}

function leaves(value: unknown, prefix: string, out: Map<string, Group>): void {
  if (typeof value === 'string') {
    const form = PLURAL.exec(prefix)
    const base = form?.[1] ?? prefix
    const group = out.get(base) ?? { texts: [], plural: false }
    group.texts.push(value)
    group.plural ||= form !== null
    out.set(base, group)
  } else if (typeof value === 'object' && value !== null) {
    for (const [name, item] of Object.entries(value)) leaves(item, `${prefix}${prefix.endsWith(':') ? '' : '.'}${name}`, out)
  }
}

/** Every plural base at count 0, 1 and 2, and every other leaf once, with the placeholders
 * filled from `SAMPLES` through `PLACEHOLDERS`. Throws on a name outside `PLACEHOLDERS`. */
export function parityCases(bundle: Bundle): ParityCase[] {
  const groups = new Map<string, Group>()
  for (const [ns, content] of Object.entries(bundle)) leaves(content, `${ns}:`, groups)
  const cases: ParityCase[] = []
  for (const [key, { texts, plural }] of groups) {
    const args: Record<string, string | number> = {}
    for (const name of texts.flatMap(placeholdersOf)) {
      const kind = PLACEHOLDERS[name]
      if (kind === undefined) throw new Error(`${key}: the placeholder ${name} is not in PLACEHOLDERS`)
      args[name] = SAMPLES[kind]
    }
    if (plural) for (const count of [0, 1, 2]) cases.push({ key, args: { ...args, count } })
    else cases.push({ key, args })
  }
  return cases
}

/** `t` as the reference uses it: a key held in a string and its arguments, not a typed key. */
type UntypedT = (key: string, options?: Record<string, string | number>) => string

/** What a fresh instance on the production options answers for a key: the reference. */
export function referenceT(bundle: LocaleBundle, tag = 'en'): (key: string, args?: Args) => string {
  const instance = i18next.createInstance()
  void instance.init({ ...productionOptions, lng: tag, ns: Object.keys(bundle), resources: { [tag]: bundle } })
  const ask: UntypedT = instance.t.bind(instance)
  return (key, args) => ask(key, { ...args })
}

type Answer = (bundle: Bundle, key: string, args: Args, tag: string) => string

/** How many cases ran and one sentence per case where `resolve` and i18next disagree. */
export function parityProblems(
  bundle: LocaleBundle,
  tag = 'en',
  resolve: Answer = resolveKey,
): { cases: number; problems: string[] } {
  let cases: ParityCase[]
  try {
    cases = parityCases(bundle)
  } catch (error) {
    return { cases: 0, problems: [error instanceof Error ? error.message : 'parityCases failed'] }
  }
  const answer = referenceT(bundle, tag)
  const problems: string[] = []
  for (const { key, args } of cases) {
    if (resolve(bundle, key, args, tag) !== answer(key, args)) {
      problems.push(`${key}: resolveKey and i18next answer differently`)
    }
  }
  return { cases: cases.length, problems: [...new Set(problems)] }
}
