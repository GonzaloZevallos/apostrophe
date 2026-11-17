/**
 * Every text a copy file holds (ADR-0049), by its key `file.EXPORT.path`: a string, the
 * string of an object's field, or what a function returns when each of its holes is filled
 * with `probe`. The registries (`REGISTRIES` below) are not texts.
 * Read by the tests that judge the copy (`architecture/copyLanguage.test.ts`,
 * `design/screens.test.ts`), never by the app.
 */

import { isKeyShaped } from '../i18n/keyShape'
import { interpolate, MissingKeyError, placeholdersOf, selectText, type Args, type Bundle } from '../i18n/resolve'

type CopyFile = Record<string, unknown>

/** The exports of a copy file that are registries, not texts. */
export const REGISTRIES: ReadonlySet<string> = new Set(['LANGUAGE', 'LIMITED_COPY', 'LONG_REFUSALS', 'NAMESPACE', 'MOVED_TO_KEYS', 'BASELINE_ARGS'])

export function textsOf(file: string, mod: CopyFile, probe: string): Map<string, string> {
  const found = new Map<string, string>()
  const walk = (key: string, value: unknown): void => {
    if (typeof value === 'string') found.set(key, value)
    else if (typeof value === 'function') {
      const text: unknown = value(...Array.from({ length: value.length }, () => probe))
      if (typeof text === 'string') found.set(key, text)
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      for (const [name, inner] of Object.entries(value)) walk(`${key}.${name}`, inner)
    }
  }
  for (const [name, value] of Object.entries(mod)) {
    if (REGISTRIES.has(name)) continue
    walk(`${file}.${name}`, value)
  }
  return found
}

/** The counts tried, in order, when a key has no bare form: `_zero`, `_one`, `_other`. */
const COUNTS: readonly (Args | undefined)[] = [undefined, { count: 0 }, { count: 1 }, { count: 2 }]

/**
 * What is wrong with `key` in `en`, or undefined when a person would be shown a text:
 * `unresolved` when no form of it exists, `unusable` when it exists but cannot be rendered
 * (an object, a `$t(`, a placeholder the probe cannot fill).
 */
function keyProblem(en: Bundle, key: string, probe: string): 'unresolved' | 'unusable' | undefined {
  for (const args of COUNTS) {
    try {
      const text = selectText(en, key, args)
      const filled: Record<string, string | number> = {}
      for (const name of placeholdersOf(text)) filled[name] = name === 'count' && args?.['count'] !== undefined ? args['count'] : probe
      interpolate(key, text, filled)
      return undefined
    } catch (error) {
      if (!(error instanceof MissingKeyError)) return 'unusable'
    }
  }
  return 'unresolved'
}

export interface Words {
  /** Every text a person would read that is written in the module itself, by `file.EXPORT.path`. */
  words: Map<string, string>
  /** What stops the walk from being trusted, sorted: `unresolved key`, `unusable key` and `unreadable export` lines. */
  findings: string[]
}

/**
 * The words a copy file writes itself (ADR-0049): `textsOf` without the keys. A string, or what
 * a function returns when each of its holes (at least one) is filled with `probe`, is a word
 * unless it is key-shaped (`isKeyShaped`); a key is checked against `en` and is a finding when no
 * text answers it. A function that throws when probed is a finding too; no finding stops the walk.
 */
export function wordsOf(file: string, mod: CopyFile, probe: string, en: Bundle): Words {
  if (isKeyShaped(probe)) throw new Error(`wordsOf: the probe "${probe}" must not be shaped like a key`)
  const words = new Map<string, string>()
  const findings = new Set<string>()
  const take = (path: string, text: string): void => {
    if (!isKeyShaped(text)) {
      words.set(path, text)
      return
    }
    const problem = keyProblem(en, text, probe)
    if (problem !== undefined) findings.add(`${problem} key ${path}`)
  }
  const walk = (path: string, value: unknown): void => {
    if (typeof value === 'string') take(path, value)
    else if (typeof value === 'function') {
      let text: unknown
      try {
        text = value(...Array.from({ length: Math.max(value.length, 1) }, () => probe))
      } catch {
        findings.add(`unreadable export ${path}`)
        return
      }
      if (typeof text === 'string') take(path, text)
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      for (const [name, inner] of Object.entries(value)) walk(`${path}.${name}`, inner)
    }
  }
  for (const [name, value] of Object.entries(mod)) {
    if (REGISTRIES.has(name)) continue
    walk(`${file}.${name}`, value)
  }
  return { words, findings: [...findings].sort() }
}
