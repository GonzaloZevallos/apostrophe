/**
 * The typed keys of a resource set: `ns:key` for every string leaf of every namespace,
 * nested keys joined with `.`, and the plural suffixes (`_one`, `_other`, ...) folded into
 * the base key, as `t('items', { count })` is written. A pure type: it reads no file.
 */
type PluralSuffix = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'

type BaseKey<K extends string> = K extends `${infer Base}_${PluralSuffix}` ? Base : K

type LeafKeys<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${BaseKey<K>}`
    : T[K] extends object
      ? LeafKeys<T[K], `${Prefix}${K}.`>
      : never
}[keyof T & string]

export type KeysOf<R> = {
  [Ns in keyof R & string]: `${Ns}:${LeafKeys<R[Ns]>}`
}[keyof R & string]
