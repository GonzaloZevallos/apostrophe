/**
 * The pure key resolver: what `i18n.t` answers for a key, computed from a bundle with no
 * runtime, so node scripts, Playwright and the checks can read English without the
 * instance. It imports nothing at all.
 *
 * - Walks the namespace (`ns:`), then the dotted path.
 * - With a numeric `count`: `<base>_zero` at 0 when it exists, otherwise the form
 *   `Intl.PluralRules(tag)` selects, otherwise `<base>_other`; if that is missing too, it throws.
 * - `{{name}}` is filled in one pass: a substituted value is never interpolated again and
 *   nothing is escaped (`escapeValue: false`, ADR-0050).
 * - It throws on a missing key, an object where a string was expected, `$t(` in a value and
 *   a placeholder with no argument. Messages name the key and the placeholder, never a value.
 */

/** A language's texts: namespace to its content. Structural, so `LocaleBundle` satisfies it. */
export type Bundle = Readonly<Record<string, unknown>>

export type Args = Readonly<Record<string, string | number>>

/** The key (or the plural form it needs) is not in the bundle. */
export class MissingKeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MissingKeyError'
  }
}

const PLACEHOLDER = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g

function child(node: unknown, name: string): unknown {
  if (typeof node !== 'object' || node === null || !Object.hasOwn(node, name)) return undefined
  return (node as Record<string, unknown>)[name]
}

function split(key: string): { ns: string; path: string[] } {
  const colon = key.indexOf(':')
  if (colon <= 0 || colon === key.length - 1) throw new MissingKeyError(`${key}: a key is 'namespace:path'`)
  return { ns: key.slice(0, colon), path: key.slice(colon + 1).split('.') }
}

function textOf(key: string, value: unknown): string {
  if (value === undefined) throw new MissingKeyError(`${key}: no such key`)
  if (typeof value !== 'string') throw new Error(`${key}: holds an object, not a text`)
  if (value.includes('$t(')) throw new Error(`${key}: holds $t(, which nothing resolves`)
  return value
}

/** The text of a key with its placeholders still in it: the plural form is chosen here. */
export function selectText(bundle: Bundle, key: string, args?: Args, tag = 'en'): string {
  const { ns, path } = split(key)
  const last = path[path.length - 1] ?? ''
  const parent = path.slice(0, -1).reduce<unknown>(child, bundle[ns])
  const count = args?.['count']
  if (typeof count !== 'number') return textOf(key, child(parent, last))
  const form = (suffix: string): unknown => child(parent, `${last}_${suffix}`)
  const zero = count === 0 ? form('zero') : undefined
  const chosen = zero ?? form(new Intl.PluralRules(tag).select(count)) ?? form('other')
  return textOf(key, chosen)
}

/** The names of the placeholders in a text, in order of appearance. */
export function placeholdersOf(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((match) => match[1] ?? '')
}

/** Fills the placeholders of `text` in one pass; `key` only names the error. */
export function interpolate(key: string, text: string, args?: Args): string {
  return text.replace(PLACEHOLDER, (_whole, name: string) => {
    const value = args !== undefined && Object.hasOwn(args, name) ? args[name] : undefined
    if (value === undefined) throw new Error(`${key}: no argument for the placeholder ${name}`)
    return String(value)
  })
}

/** What `i18n.t(key, args)` answers in `tag`, from `bundle` alone. */
export function resolveKey(bundle: Bundle, key: string, args?: Args, tag = 'en'): string {
  return interpolate(key, selectText(bundle, key, args, tag), args)
}
