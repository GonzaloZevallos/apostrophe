/**
 * The key type of a refusal and the guards that build the code-to-key table without a cast.
 * Pure: it imports no i18next instance, so a helper outside React can use it (a reader gets
 * the text through `refusalText(t, refusal)` or, outside React, `resolveKey(enBundle, key)`).
 *
 * - `RefusalKey` is `refusals:<leaf>` for a leaf of `locales/en/refusals.json`, so a text, or
 *   any string, passed where a refusal is expected fails `tsc`.
 * - `Refusal` wraps it in an object, so a refusal is never a bare string either.
 * - Every guard error names the code, never the value it was given.
 */

import type enRefusals from '../copy/locales/en/refusals.json'

export type RefusalKey = `refusals:${keyof typeof enRefusals & string}`

export type Refusal = { readonly key: RefusalKey }

/** What `useTranslation().t` answers for a refusal key. */
export type Translate = (key: RefusalKey) => string

const NAMESPACE_PREFIX = 'refusals:'

/** `k` is an own key of `obj`; `toString`, `__proto__` and `constructor` are not. */
export function isKeyOf<T extends object>(obj: T, k: string): k is keyof T & string {
  return Object.hasOwn(obj, k)
}

/** A guard for `refusals:<leaf>` where the leaf is a non-empty, dotless own key of `bundle`. */
export function isRefusalKey<B extends object>(
  bundle: B,
): (value: unknown) => value is `refusals:${keyof B & string}` {
  return (value: unknown): value is `refusals:${keyof B & string}` => {
    if (typeof value !== 'string' || !value.startsWith(NAMESPACE_PREFIX)) return false
    const leaf = value.slice(NAMESPACE_PREFIX.length)
    return leaf !== '' && !leaf.includes('.') && isKeyOf(bundle, leaf)
  }
}

/** Closes a partly filled table: true when every one of `codes` has an entry. */
export function isComplete<C extends string, V>(
  partial: Partial<Record<C, V>>,
  codes: readonly C[],
): partial is Record<C, V> {
  return codes.every((code) => Object.hasOwn(partial, code))
}

/**
 * The key of every code, from the hand-kept `map`: throws naming the code, never the value,
 * for a code with no entry or an entry that is not a refusal key of `bundle`.
 */
export function buildRefusalKeys<B extends object, C extends string>(
  map: Readonly<Record<string, unknown>>,
  bundle: B,
  codes: readonly C[],
): Record<C, `refusals:${keyof B & string}`> {
  const isKey = isRefusalKey(bundle)
  const built: Partial<Record<C, `refusals:${keyof B & string}`>> = {}
  for (const code of codes) {
    const value = Object.hasOwn(map, code) ? map[code] : undefined
    if (value === undefined) throw new Error(`${code}: has no refusal key`)
    if (!isKey(value)) throw new Error(`${code}: its refusal key is not a key of refusals`)
    built[code] = value
  }
  if (!isComplete(built, codes)) throw new Error('refusal keys: a code has none')
  return built
}

/** A screen's message for a code: a `Refusal` resolves through `refusalText`, a fixed text stays. */
export function messageText(t: Translate, message: Refusal | string): string {
  return typeof message === 'string' ? message : refusalText(t, message)
}

/** The text of a refusal in the language `t` answers in; English when that language lacks it. */
export function refusalText(t: Translate, refusal: Refusal): string {
  return t(refusal.key)
}
