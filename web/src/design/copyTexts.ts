/**
 * Every text a copy file holds (ADR-0049), by its key `file.EXPORT.path`: a string, the
 * string of an object's field, or what a function returns when each of its holes is filled
 * with `probe`. The registries (`LANGUAGE`, `LIMITED_COPY`, `LONG_REFUSALS`) are not texts.
 * Read by the tests that judge the copy (`architecture/copyLanguage.test.ts`,
 * `design/screens.test.ts`), never by the app.
 */

type CopyFile = Record<string, unknown>

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
    if (name === 'LANGUAGE' || name === 'LIMITED_COPY' || name === 'LONG_REFUSALS') continue
    walk(`${file}.${name}`, value)
  }
  return found
}
