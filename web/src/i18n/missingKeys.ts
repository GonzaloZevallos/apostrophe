/**
 * The one record of translation keys that were asked for and not found. It keeps
 * `{language, ns, key}` and nothing else: the fallback value and the interpolation options
 * i18next hands the handler may carry a person's text, so they are dropped unread.
 * Nothing is printed. The handler is installed only in test mode (`./index.ts`).
 */
export interface MissingKey {
  readonly language: string
  readonly ns: string
  readonly key: string
}

const recorded: MissingKey[] = []

/** The i18next `missingKeyHandler`. Its last three parameters are never read. */
export function missingKeyHandler(
  languages: readonly string[] | string,
  ns: string,
  key: string,
  ..._unread: readonly unknown[]
): void {
  const language = typeof languages === 'string' ? languages : (languages[0] ?? '')
  recorded.push({ language, ns, key })
}

export function missingKeys(): readonly MissingKey[] {
  return recorded.map((miss) => ({ ...miss }))
}

export function clearMissingKeys(): void {
  recorded.length = 0
}

/** Throws when English, the language every key is written in, missed a key. */
export function assertNoEnglishMisses(misses: readonly MissingKey[]): void {
  const english = misses.filter((miss) => miss.language === 'en')
  if (english.length === 0) return
  const keys = english.map((miss) => `${miss.ns}:${miss.key}`).join(', ')
  throw new Error(`English is missing translation keys: ${keys}`)
}
