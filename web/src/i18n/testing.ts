import type { TFunction } from 'i18next'
import i18n from '.'

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
