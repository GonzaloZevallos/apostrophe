import type { TFunction } from 'i18next'
import i18n from '.'
import baselineEntries from '../copy/en.baseline.json'

/**
 * Test helper: adds a fixture namespace to the instance. The typed `t` knows only the
 * committed English files, so a test reads the fixture through `looseT`.
 */
export function addFixtureNamespace(
  ns: string,
  content: Record<string, unknown>,
  language = 'en',
): void {
  i18n.addResourceBundle(language, ns, content, true, true)
}

export function removeFixtureNamespace(ns: string, language = 'en'): void {
  i18n.removeResourceBundle(language, ns)
}

type LooseOptions = Readonly<Record<string, string | number>>

/** `t` without the key types, for a namespace that is not in the committed English files. */
export function looseT(key: string, options?: LooseOptions): string {
  return String(i18n.t(key as never, { ...options } as never))
}

/**
 * The instance's `t`, for a test of a helper that takes `t` from its caller (a rendered
 * component gets its own from `useTranslation`).
 */
export const testT: TFunction = i18n.t

/** The language the instance shows now, for a test outside `i18n/` that asserts on a switch. */
export function shownLanguage(): string {
  return i18n.language
}

interface BaselineEntry {
  readonly source: string
  readonly text: string
}

const baseline: readonly BaselineEntry[] = baselineEntries

/**
 * The English a screen test expects, by the id of the copy file export it came from
 * (`copy/en.baseline.json`, e.g. `customers.ts:NOBODY_OWES`). It never resolves a key: the
 * test must fail if the key the screen renders points at the wrong text.
 */
export function baselineText(source: string): string {
  const found = baseline.filter((entry) => entry.source === source)
  if (found.length !== 1) throw new Error(`en.baseline.json has ${found.length} entries for ${source}`)
  return found[0]!.text
}
